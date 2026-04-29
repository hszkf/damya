-- Create jobs table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'jobs')
BEGIN
    CREATE TABLE jobs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        job_name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        job_type NVARCHAR(50) NOT NULL, -- 'workflow' or 'function'
        schedule_type NVARCHAR(50), -- 'cron', 'interval', 'date'
        schedule_config NVARCHAR(MAX), -- JSON
        workflow_definition NVARCHAR(MAX), -- JSON
        target_function NVARCHAR(255),
        parameters NVARCHAR(MAX), -- JSON
        output_format NVARCHAR(20) DEFAULT 'csv', -- 'csv', 'excel', 'json'
        author NVARCHAR(255),
        is_active BIT DEFAULT 1,
        next_run_time DATETIME,
        last_run_time DATETIME,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        max_retries INT DEFAULT 0,
        retry_delay_seconds INT DEFAULT 60,
        notify_on_success BIT DEFAULT 0,
        notify_on_failure BIT DEFAULT 1,
        timeout_seconds INT,
        tags NVARCHAR(MAX) -- JSON array
    );

    CREATE INDEX IX_jobs_author ON jobs(author);
    CREATE INDEX IX_jobs_job_type ON jobs(job_type);
    CREATE INDEX IX_jobs_is_active ON jobs(is_active);
    CREATE INDEX IX_jobs_next_run_time ON jobs(next_run_time);
END;
GO

-- Create job_executions table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'job_executions')
BEGIN
    CREATE TABLE job_executions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        job_id INT NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
        trigger_type NVARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled'
        started_at DATETIME DEFAULT GETDATE(),
        completed_at DATETIME,
        duration_seconds INT,
        error_message NVARCHAR(MAX),
        output_file_path NVARCHAR(500),
        output_file_size_bytes BIGINT,
        rows_processed INT,
        step_results NVARCHAR(MAX), -- JSON array of step results
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_job_executions_job_id ON job_executions(job_id);
    CREATE INDEX IX_job_executions_status ON job_executions(status);
    CREATE INDEX IX_job_executions_started_at ON job_executions(started_at);
END;
GO

-- Create job_step_results table (optional - detailed step tracking)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'job_step_results')
BEGIN
    CREATE TABLE job_step_results (
        id INT IDENTITY(1,1) PRIMARY KEY,
        execution_id INT NOT NULL,
        step_number INT NOT NULL,
        step_name NVARCHAR(255),
        step_type NVARCHAR(50), -- 'redshift_query', 'sqlserver_query', 'merge'
        status NVARCHAR(50) NOT NULL,
        started_at DATETIME,
        completed_at DATETIME,
        duration_seconds INT,
        error_message NVARCHAR(MAX),
        rows_returned INT,
        output_preview NVARCHAR(MAX), -- JSON array of first N rows
        FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
    );

    CREATE INDEX IX_job_step_results_execution_id ON job_step_results(execution_id);
END;
GO
