"""
Generic AWS Glue job template for Damya Data Products Platform.
Reads YAML config + SQL from S3, executes via Spark, exports to Excel,
uploads to S3 and SharePoint, sends email notification.
"""
import os
import sys
import tempfile
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import SparkSession
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Tuple
import boto3
import yaml
import pandas as pd
import requests
from office365.sharepoint.client_context import ClientContext
from office365.runtime.auth.token_response import TokenResponse
import msal


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _cfg(config: Dict[str, Any], *keys, default=None):
    node = config
    for k in keys:
        if isinstance(node, dict) and k in node:
            node = node[k]
        else:
            return default
    return node


def download_from_s3(s3_path: str, local_path: str) -> None:
    s3 = boto3.client('s3')
    parts = s3_path.replace('s3://', '').split('/', 1)
    bucket, key = parts[0], parts[1]
    s3.download_file(bucket, key, local_path)


def load_config(yaml_file: str) -> Dict[str, Any]:
    with open(yaml_file, 'r') as f:
        return yaml.safe_load(f)


def parse_tagged_sql(sql_file: str) -> Dict[str, str]:
    with open(sql_file, 'r') as f:
        content = f.read()
    queries = {}
    current_tag = None
    current_lines = []
    for line in content.split('\n'):
        stripped = line.strip()
        if stripped.startswith('-- @') and stripped.endswith('_sql'):
            if current_tag is not None:
                queries[current_tag] = '\n'.join(current_lines)
            current_tag = stripped.replace('-- @', '')
            current_lines = []
        elif current_tag is not None:
            current_lines.append(line)
    if current_tag is not None:
        queries[current_tag] = '\n'.join(current_lines)
    # If no tags found, return entire content under 'main_sql'
    if not queries and content.strip():
        queries['main_sql'] = content.strip()
    return queries


# ---------------------------------------------------------------------------
# Spark
# ---------------------------------------------------------------------------

def init_spark(config: Dict[str, Any]) -> Tuple[SparkContext, GlueContext, SparkSession, Job]:
    try:
        sc = SparkContext.getOrCreate()
        glue_context = GlueContext(sc)

        spark = SparkSession.builder \
            .appName(config['job']['name']) \
            .config("spark.sql.shuffle.partitions", "200") \
            .config("spark.default.parallelism", "200") \
            .config("spark.sql.files.maxPartitionBytes", "134217728") \
            .config("spark.sql.autoBroadcastJoinThreshold", "52428800") \
            .config("spark.sql.broadcastTimeout", "600") \
            .config("spark.memory.fraction", "0.85") \
            .config("spark.memory.storageFraction", "0.25") \
            .config("spark.shuffle.compress", "true") \
            .config("spark.shuffle.spill.compress", "true") \
            .config("spark.shuffle.file.buffer", "1mb") \
            .config("spark.unsafe.sorter.spill.reader.buffer.size", "1mb") \
            .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
            .config("spark.kryoserializer.buffer.max", "1g") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .config("spark.sql.adaptive.skewJoin.enabled", "true") \
            .config("spark.sql.adaptive.localShuffleReader.enabled", "true") \
            .config("spark.sql.codegen.wholeStage", "true") \
            .config("spark.sql.codegen.aggregate.map.twolevel.enabled", "true") \
            .config("spark.rdd.compress", "true") \
            .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
            .config("spark.sql.catalog.glue_catalog", "org.apache.iceberg.spark.SparkCatalog") \
            .config("spark.sql.catalog.glue_catalog.warehouse", "s3://prod-545009847083-on-prem-archived-s3") \
            .config("spark.sql.catalog.glue_catalog.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog") \
            .config("spark.sql.catalog.glue_catalog.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
            .enableHiveSupport() \
            .getOrCreate()

        spark.conf.set("hive.metastore.client.factory.class",
                       "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory")
        spark.conf.set("spark.sql.session.timeZone", "Asia/Kuala_Lumpur")

        for key, value in _cfg(config, 'spark', 'config', default={}).items():
            spark.conf.set(key, value)

        job = Job(glue_context)
        job_args = {f'--{k}': str(v) for k, v in _cfg(config, 'spark', 'job_args', default={}).items()}
        job.init(config['job']['name'], job_args)

        return sc, glue_context, spark, job
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Spark: {str(e)}")


# ---------------------------------------------------------------------------
# Report date
# ---------------------------------------------------------------------------

def get_report_date() -> Tuple[datetime, str]:
    malaysia_tz = timezone(timedelta(hours=8))
    now = datetime.now(malaysia_tz)
    yesterday = now - timedelta(days=1)
    date_str = yesterday.strftime('%Y%m%d')
    return yesterday, date_str


# ---------------------------------------------------------------------------
# Excel export
# ---------------------------------------------------------------------------

def export_to_excel(df, output_path: str, config: Dict[str, Any]) -> None:
    try:
        pandas_df = df.toPandas()

        for col in pandas_df.columns:
            if 'id' in col.lower() or 'cic' in col.lower():
                pandas_df[col] = pandas_df[col].astype(str)

        float_format = _cfg(config, 'excel', 'float_format', default='%.2f')
        max_col_width = _cfg(config, 'excel', 'max_column_width', default=50)
        sheet_names = _cfg(config, 'excel', 'sheets', default=['Report'])
        sheet_name = sheet_names[0] if sheet_names else 'Report'
        if len(sheet_name) > 31:
            sheet_name = sheet_name[:31]

        with pd.ExcelWriter(output_path, engine='xlsxwriter') as writer:
            pandas_df.to_excel(writer, index=False, sheet_name=sheet_name, float_format=float_format)
            workbook = writer.book
            worksheet = writer.sheets[sheet_name]

            header_cfg = _cfg(config, 'excel', 'header_format', default={
                'bold': False, 'text_wrap': True, 'valign': 'vcenter',
                'align': 'center', 'bg_color': '#4F81BD', 'font_color': 'white', 'border': 1,
            })
            header_format = workbook.add_format(header_cfg)

            for i, col in enumerate(pandas_df.columns):
                col_header_len = len(str(col))
                if len(pandas_df) > 0:
                    col_data_len = pandas_df[col].astype(str).apply(len).max()
                    max_length = max(col_data_len, col_header_len)
                else:
                    max_length = col_header_len
                worksheet.set_column(i, i, min(max_length + 2, max_col_width))
                worksheet.write(0, i, col, header_format)

        worksheet.set_selection('A1')
    except Exception as e:
        raise RuntimeError(f"Error exporting to Excel: {str(e)}")


# ---------------------------------------------------------------------------
# S3 upload
# ---------------------------------------------------------------------------

def upload_to_s3(local_path: str, bucket: str, key: str) -> None:
    s3_client = boto3.client('s3')
    s3_client.upload_file(local_path, bucket, key)


# ---------------------------------------------------------------------------
# SharePoint auth + upload
# ---------------------------------------------------------------------------

def get_sharepoint_access_token(config: Dict[str, Any]):
    auth = config['sharepoint']['auth']
    authority_url = f"https://login.microsoftonline.com/{auth['tenant']}"
    credentials = {
        "thumbprint": auth['thumbprint'],
        "private_key": auth['private_key'],
    }
    scope = f"{auth['resource']}/.default"
    app = msal.ConfidentialClientApplication(
        auth['client_id'],
        authority=authority_url,
        client_credential=credentials,
    )
    result = app.acquire_token_for_client([scope])
    if "access_token" not in result:
        raise RuntimeError(f"Failed to acquire token: {result.get('error_description', result)}")
    return result["access_token"], TokenResponse.from_json(result)


def _resolve_folder_path(root_folder, path_parts):
    current_folder = root_folder
    for folder_name in path_parts:
        try:
            folder = current_folder.folders.get_by_url(folder_name).get().execute_query()
        except Exception:
            folder = current_folder.folders.add(folder_name).execute_query()
        current_folder = folder
    return current_folder


def upload_to_sharepoint(config: Dict[str, Any], local_file: str, filename: str) -> str:
    sp_config = config['sharepoint']
    access_token, token_response = get_sharepoint_access_token(config)
    ctx = ClientContext(sp_config['site_url']).with_access_token(lambda: token_response)

    doc_lib = ctx.web.lists.get_by_title(sp_config['document_library'])
    folder_path = _cfg(sp_config, 'folder_path', default=[])
    target_folder = _resolve_folder_path(doc_lib.root_folder, folder_path)

    with open(local_file, 'rb') as f:
        file_bytes = f.read()
        uploaded = target_folder.upload_file(filename, file_bytes).execute_query()
        print(f"Uploaded to SharePoint: {uploaded.serverRelativeUrl}")

    return f"{sp_config['site_url']}{target_folder.serverRelativeUrl}"


# ---------------------------------------------------------------------------
# Email notification
# ---------------------------------------------------------------------------

def send_notification_email(config: Dict[str, Any], sharepoint_url: str,
                           record_count: int, date_str: str, s3_uri: str) -> None:
    email_config = config['email']
    access_token = get_sharepoint_access_token(config)[0]

    graph_endpoint = email_config['graph_endpoint']
    url = f"{graph_endpoint}/users/{email_config['from']}/sendMail"
    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    subject = email_config.get('subject', '[Report] Report Ready')
    subject = subject.replace('{report_date}', date_str)

    report_name = _cfg(config, 'job', 'description', default='Report')
    html_body = f"""
<html>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#212529;padding:16px;">
  <h2 style="color:#1F3864;margin-bottom:4px;">{report_name}</h2>
  <p>The report for <strong>{date_str}</strong> is ready.</p>

  <table style="margin-bottom:20px;border-collapse:collapse;">
    <tr>
      <td style="padding:4px 16px 4px 0;"><strong>Records:</strong> {record_count}</td>
      <td style="padding:4px 16px 4px 0;"><strong>Date:</strong> {date_str}</td>
    </tr>
  </table>

  <p>
    <a href="{sharepoint_url}"
       style="display:inline-block;padding:10px 20px;background-color:#1F3864;color:white;
              text-decoration:none;border-radius:4px;font-weight:bold;">
      Open Report in SharePoint
    </a>
  </p>

  <p style="color:#6c757d;font-size:11px;margin-top:24px;">
    Generated at {generated_at} MYT by Damya automated pipeline.
  </p>
  <p style="color:#dc3545;font-size:10px;margin-top:12px;font-style:italic;">
    Authorised access only. Protect customer and sensitive data.
  </p>
</body>
</html>
"""

    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html_body},
            "toRecipients": [{"emailAddress": {"address": addr}} for addr in email_config['to']],
            "ccRecipients": [{"emailAddress": {"address": addr}} for addr in email_config.get('cc', [])],
        },
        "saveToSentItems": "true",
    }

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 202:
        print(f"Email sent to {', '.join(email_config['to'])}")
    else:
        raise RuntimeError(f"Failed to send email: HTTP {response.status_code} - {response.text}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = getResolvedOptions(sys.argv, ['YAML_S3_PATH', 'SQL_S3_PATH'])
    temp_dir = tempfile.mkdtemp()
    yaml_file = os.path.join(temp_dir, 'config.yaml')
    sql_file = os.path.join(temp_dir, 'query.sql')

    download_from_s3(args['YAML_S3_PATH'], yaml_file)
    download_from_s3(args['SQL_S3_PATH'], sql_file)

    try:
        config = load_config(yaml_file)
        sql_queries = parse_tagged_sql(sql_file)
        sc, _, spark, job = init_spark(config)

        # Get the SQL tag name from config or default to first available
        sql_tag = _cfg(config, 'job', 'sql_tag', default='main_sql')
        sql_text = sql_queries.get(sql_tag)
        if not sql_text:
            # Fall back to first query
            sql_text = next(iter(sql_queries.values()), '')
        if not sql_text:
            raise RuntimeError(f"No SQL query found (tag: {sql_tag})")

        # Replace {report_date} with yesterday's date
        yesterday, date_str = get_report_date()
        report_date_str = yesterday.strftime('%Y-%m-%d')
        sql_text = sql_text.replace('{report_date}', report_date_str)

        df = spark.sql(sql_text)
        df_count = df.count()
        print(f"Query returned {df_count} rows")

        # Generate output paths
        malaysia_tz = timezone(timedelta(hours=8))
        now_myt = datetime.now(malaysia_tz)
        current_timestamp = now_myt.strftime('%H%M%S')

        year = yesterday.strftime('%Y')
        month = yesterday.strftime('%m')
        day = yesterday.strftime('%d')

        bucket = config['s3']['output']['bucket']
        directory = config['s3']['output']['directory']
        base_path = f"s3://{bucket}/{directory}"
        partitioned_path = f"{base_path}/year={year}/month={month}/day={day}"

        job_name = config['job']['name']
        filename = f"{job_name}_{date_str}_{current_timestamp}.xlsx"
        local_temp_file = f"/tmp/{filename}"

        # Export to Excel
        export_to_excel(df, local_temp_file, config)

        # Upload to S3
        s3_key = f"{directory}/year={year}/month={month}/day={day}/{df_count}_{filename}"
        upload_to_s3(local_temp_file, bucket, s3_key)
        s3_uri = f"s3://{bucket}/{s3_key}"
        print(f"Uploaded to S3: {s3_uri}")

        # Upload to SharePoint
        sharepoint_filename = f"{job_name}_report-{date_str}.xlsx"
        sharepoint_url = upload_to_sharepoint(config, local_temp_file, sharepoint_filename)

        # Send notification email
        send_notification_email(config, sharepoint_url, df_count, date_str, s3_uri)

        os.remove(local_temp_file)
        job.commit()

    except Exception as e:
        print(f"Error executing Glue job: {str(e)}")
        raise
    finally:
        if 'sc' in locals():
            sc.stop()


if __name__ == "__main__":
    main()
