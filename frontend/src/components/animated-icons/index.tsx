

import { motion, Transition } from "motion/react";
import { forwardRef, SVGProps } from "react";

// Default transition for smooth animations
const defaultTransition: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

const strokeTransition: Transition = {
  duration: 0.4,
  ease: "easeInOut",
};

interface AnimatedIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  animate?: boolean;
}

// Panel Left - slides in from left
export const AnimatedPanelLeft = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, animate = true, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
      <motion.path
        d="M9 3v18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
      <motion.path
        d="m14 9 3 3-3 3"
        initial={{ x: -5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
    </svg>
  )
);
AnimatedPanelLeft.displayName = "AnimatedPanelLeft";

// Panel Left Close - slides arrow out
export const AnimatedPanelLeftClose = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
      <motion.path
        d="M9 3v18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
      <motion.path
        d="m16 15-3-3 3-3"
        initial={{ x: 5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
    </svg>
  )
);
AnimatedPanelLeftClose.displayName = "AnimatedPanelLeftClose";

// Plus - rotates and scales in
export const AnimatedPlus = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ rotate: -90, scale: 0.8 }}
      animate={{ rotate: 0, scale: 1 }}
      whileHover={{ rotate: 90, scale: 1.1 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M5 12h14"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
      <motion.path
        d="M12 5v14"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
    </motion.svg>
  )
);
AnimatedPlus.displayName = "AnimatedPlus";

// Message Square - bubble pops in
export const AnimatedMessageSquare = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.5 }}
      />
    </svg>
  )
);
AnimatedMessageSquare.displayName = "AnimatedMessageSquare";

// Search - magnifying glass zooms in
export const AnimatedSearch = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.circle
        cx="11"
        cy="11"
        r="8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.5 }}
      />
      <motion.path
        d="m21 21-4.3-4.3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
    </motion.svg>
  )
);
AnimatedSearch.displayName = "AnimatedSearch";

// Sparkles - twinkle effect
export const AnimatedSparkles = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.1 }}
      />
      <motion.path
        d="M20 3v4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
      <motion.path
        d="M22 5h-4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.4 }}
      />
      <motion.path
        d="M4 17v2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.5 }}
      />
      <motion.path
        d="M5 18H3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.6 }}
      />
    </svg>
  )
);
AnimatedSparkles.displayName = "AnimatedSparkles";

// Brain - pulses gently
export const AnimatedBrain = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.6 }}
      />
      <motion.path
        d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.6, delay: 0.2 }}
      />
      <motion.path
        d="M12 5v14"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.5 }}
      />
    </motion.svg>
  )
);
AnimatedBrain.displayName = "AnimatedBrain";

// Send - swoops to the right
export const AnimatedSend = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ x: 2, y: -2 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.4 }}
      />
      <motion.path
        d="m21.854 2.147-10.94 10.939"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
    </motion.svg>
  )
);
AnimatedSend.displayName = "AnimatedSend";

// Trash - shakes on hover
export const AnimatedTrash2 = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ rotate: [-5, 5, -5, 0] }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      <motion.path
        d="M3 6h18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
      <motion.path
        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.line
        x1="10"
        x2="10"
        y1="11"
        y2="17"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
      <motion.line
        x1="14"
        x2="14"
        y1="11"
        y2="17"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.35 }}
      />
    </motion.svg>
  )
);
AnimatedTrash2.displayName = "AnimatedTrash2";

// Archive - lid opens
export const AnimatedArchive = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.rect
        x="2"
        y="3"
        width="20"
        height="5"
        rx="1"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...defaultTransition }}
      />
      <motion.path
        d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.line
        x1="10"
        x2="14"
        y1="12"
        y2="12"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
    </svg>
  )
);
AnimatedArchive.displayName = "AnimatedArchive";

// Paperclip - swings in
export const AnimatedPaperclip = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ rotate: -20 }}
      animate={{ rotate: 0 }}
      whileHover={{ rotate: 15 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, duration: 0.5 }}
      />
    </motion.svg>
  )
);
AnimatedPaperclip.displayName = "AnimatedPaperclip";

// X (Close) - fades and scales in
export const AnimatedX = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ scale: 0.8, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.1, rotate: 90 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M18 6 6 18"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="m6 6 12 12"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
    </motion.svg>
  )
);
AnimatedX.displayName = "AnimatedX";

// Bot - bounces in
export const AnimatedBot = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ y: -5 }}
      animate={{ y: 0 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M12 8V4H8"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.rect
        x="4"
        y="8"
        width="16"
        height="12"
        rx="2"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.1 }}
      />
      <motion.path
        d="M2 14h2"
        initial={{ x: -5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.3 }}
      />
      <motion.path
        d="M20 14h2"
        initial={{ x: 5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.3 }}
      />
      <motion.path
        d="M15 13v2"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
      <motion.path
        d="M9 13v2"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
    </motion.svg>
  )
);
AnimatedBot.displayName = "AnimatedBot";

// User - slides up
export const AnimatedUser = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.circle
        cx="12"
        cy="8"
        r="5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...defaultTransition }}
      />
      <motion.path
        d="M20 21a8 8 0 0 0-16 0"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
    </svg>
  )
);
AnimatedUser.displayName = "AnimatedUser";

// Database - stacks up
export const AnimatedDatabase = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...defaultTransition }}
      />
      <motion.path
        d="M3 5V19A9 3 0 0 0 21 19V5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.path
        d="M3 12A9 3 0 0 0 21 12"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
    </svg>
  )
);
AnimatedDatabase.displayName = "AnimatedDatabase";

// Code2 - types in
export const AnimatedCode2 = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.path
        d="m18 16 4-4-4-4"
        initial={{ x: -5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.2 }}
      />
      <motion.path
        d="m6 8-4 4 4 4"
        initial={{ x: 5, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...defaultTransition, delay: 0.2 }}
      />
      <motion.path
        d="m14.5 4-5 16"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.1 }}
      />
    </svg>
  )
);
AnimatedCode2.displayName = "AnimatedCode2";

// Zap - lightning strike
export const AnimatedZap = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ y: -5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, duration: 0.4 }}
      />
    </motion.svg>
  )
);
AnimatedZap.displayName = "AnimatedZap";

// Loader2 - spins
export const AnimatedLoader2 = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </motion.svg>
  )
);
AnimatedLoader2.displayName = "AnimatedLoader2";

// ChevronDown - bounces
export const AnimatedChevronDown = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ y: -3 }}
      animate={{ y: 0 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.path
        d="m6 9 6 6 6-6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition }}
      />
    </motion.svg>
  )
);
AnimatedChevronDown.displayName = "AnimatedChevronDown";

// AlertCircle - pulses
export const AnimatedAlertCircle = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      {...props}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M12 8v4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.path
        d="M12 16h.01"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
    </motion.svg>
  )
);
AnimatedAlertCircle.displayName = "AnimatedAlertCircle";

// Clock - hands tick
export const AnimatedClock = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.polyline
        points="12 6 12 12 16 14"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
    </svg>
  )
);
AnimatedClock.displayName = "AnimatedClock";

// Square - for stop button
export const AnimatedSquare = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ scale: 1.1 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={defaultTransition}
      />
    </motion.svg>
  )
);
AnimatedSquare.displayName = "AnimatedSquare";

// File icons
export const AnimatedFileText = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.path
        d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M14 2v4a2 2 0 0 0 2 2h4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.path
        d="M10 9H8"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...defaultTransition, delay: 0.3 }}
      />
      <motion.path
        d="M16 13H8"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...defaultTransition, delay: 0.4 }}
      />
      <motion.path
        d="M16 17H8"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ ...defaultTransition, delay: 0.5 }}
      />
    </svg>
  )
);
AnimatedFileText.displayName = "AnimatedFileText";

export const AnimatedImage = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        ry="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.circle
        cx="9"
        cy="9"
        r="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...defaultTransition, delay: 0.2 }}
      />
      <motion.path
        d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
    </svg>
  )
);
AnimatedImage.displayName = "AnimatedImage";

export const AnimatedFile = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <motion.path
        d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M14 2v4a2 2 0 0 0 2 2h4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
    </svg>
  )
);
AnimatedFile.displayName = "AnimatedFile";

// Copy - clipboard animation
export const AnimatedCopy = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={defaultTransition}
      {...props}
    >
      <motion.rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        ry="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
    </motion.svg>
  )
);
AnimatedCopy.displayName = "AnimatedCopy";

// Check - checkmark for copy success
export const AnimatedCheck = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      {...props}
    >
      <motion.path
        d="M20 6 9 17l-5-5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </motion.svg>
  )
);
AnimatedCheck.displayName = "AnimatedCheck";

// RefreshCw - rotate animation for regenerate
export const AnimatedRefreshCw = forwardRef<SVGSVGElement, AnimatedIconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <motion.svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      whileHover={{ rotate: 180 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      {...props}
    >
      <motion.path
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition }}
      />
      <motion.path
        d="M21 3v5h-5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.2 }}
      />
      <motion.path
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.3 }}
      />
      <motion.path
        d="M8 16H3v5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ ...strokeTransition, delay: 0.4 }}
      />
    </motion.svg>
  )
);
AnimatedRefreshCw.displayName = "AnimatedRefreshCw";
