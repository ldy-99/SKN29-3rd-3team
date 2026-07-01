import React from "react";
import { Info, AlertCircle, XCircle, CheckCircle } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[#e5e5e7] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function ApiBadge({ method, endpoint }: { method: string; endpoint: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#6e6e73] bg-[#f5f5f7] border border-[#e5e5e7] rounded-full px-2.5 py-1 mb-4 opacity-70 hover:opacity-100 transition-opacity" title="Developer API Reference">
      <span className="font-semibold text-[#1d1d1f]">{method}</span>
      <span>{endpoint}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    CALCULATED: { color: "bg-[#34c759]/10 text-[#34c759]", label: "진단 완료" },
    PARTIAL: { color: "bg-[#ff9f0a]/10 text-[#ff9f0a]", label: "제한적 진단" },
    SKIPPED_MISSING_INPUTS: { color: "bg-[#e5e5e7] text-[#6e6e73]", label: "진단 불가" },
    FAILED: { color: "bg-[#ff3b30]/10 text-[#ff3b30]", label: "진단 실패" },
    NEEDS_REVIEW: { color: "bg-[#ff9f0a]/10 text-[#ff9f0a]", label: "확인 필요" },
    SUCCEEDED: { color: "bg-[#007aff]/10 text-[#007aff]", label: "성공" },
  };

  const config = statusConfig[status] || { color: "bg-[#f5f5f7] text-[#6e6e73]", label: status };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

export function WarningBox({
  type = "info",
  title,
  children,
  className = ""
}: {
  type?: "info" | "warning" | "error" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-[#f5f5f7] text-[#1d1d1f]",
    warning: "bg-[#ff9f0a]/10 text-[#1d1d1f]",
    error: "bg-[#ff3b30]/10 text-[#1d1d1f]",
    success: "bg-[#34c759]/10 text-[#1d1d1f]",
  };

  const icons = {
    info: <Info className="w-5 h-5 text-[#007aff] mt-0.5 flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-[#ff9f0a] mt-0.5 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-[#ff3b30] mt-0.5 flex-shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-[#34c759] mt-0.5 flex-shrink-0" />,
  };

  return (
    <div className={`p-5 rounded-[20px] flex gap-3 ${styles[type]} mb-6 ${className}`}>
      {icons[type]}
      <div>
        {title && <h4 className="font-semibold text-[15px] mb-1">{title}</h4>}
        <div className="text-[14px] text-[#6e6e73] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" }) {
  const base = "inline-flex items-center justify-center px-5 py-3 rounded-[16px] font-semibold transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-[15px]";
  
  const variants = {
    primary: "bg-[#007aff] text-white hover:bg-[#006ee6] focus:ring-[#007aff]",
    secondary: "bg-[#1d1d1f] text-white hover:bg-[#2c2c2e] focus:ring-[#1d1d1f]",
    outline: "border border-[#e5e5e7] text-[#1d1d1f] bg-white hover:bg-[#f5f5f7] focus:ring-[#e5e5e7]",
    ghost: "text-[#007aff] hover:bg-[#007aff]/10 focus:ring-[#007aff]",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] tracking-tight leading-tight">{title}</h1>
        {description && <p className="mt-2 text-[17px] text-[#6e6e73] max-w-2xl">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function FormGroup({ label, required, children, helperText }: { label: string; required?: boolean; children: React.ReactNode; helperText?: string }) {
  return (
    <div className="py-4 border-b border-[#e5e5e7] last:border-0 flex flex-col md:flex-row md:items-center gap-4">
      <div className="md:w-1/3 shrink-0">
        <label className="block text-[15px] font-medium text-[#1d1d1f] flex items-center gap-1.5">
          {label}
          {required && <span className="w-1.5 h-1.5 rounded-full bg-[#007aff]" title="필수"></span>}
        </label>
        {helperText && <p className="mt-1 text-[13px] text-[#6e6e73]">{helperText}</p>}
      </div>
      <div className="md:w-2/3 flex-1 flex flex-col justify-center">
        {children}
      </div>
    </div>
  );
}

export function SettingsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[24px] border border-[#e5e5e7] shadow-[0_2px_10px_rgba(0,0,0,0.02)] px-6 py-2">
      {children}
    </div>
  );
}
