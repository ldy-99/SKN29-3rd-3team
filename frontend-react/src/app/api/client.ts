// 역할: React 화면들이 Django 공개 API를 호출할 때 사용하는 공통 client입니다.
// 모든 요청은 Django API로 전송하며 로컬 fixture fallback을 사용하지 않습니다.
/// <reference types="vite/client" />

export type ApiEnvelope<T> = {
  data: T | null;
  error: null | {
    code: string;
    message: string;
    field_errors?: Record<string, unknown>;
  };
  request_id?: string;
};

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  date_joined?: string;
};

export type StrategyRecord = {
  id?: string;
  strategy_id: string;
  status: string;
  diagnosis_mode?: string;
  overall_analysis_status?: string;
  recommended_supply?: string | null;
  recommended_supply_types?: Array<Record<string, unknown>>;
  supply_rank?: Array<Record<string, unknown>>;
  missing_fields_by_supply_type?: Record<string, unknown>;
  warnings?: string[];
  announcement_confirmed?: Record<string, unknown> | null;
  input_snapshot?: Record<string, unknown> | null;
  result_payload?: Record<string, unknown> | null;
  report?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

export type PdfAnalysisResponse = {
  pdf_analysis_id: string;
  extraction_status: string;
  filename: string;
  page_count: number;
  text_length: number;
  combined_text_length: number;
  table_count: number;
  truncated: boolean;
  preview: string;
  raw_preview?: string;
  summary_text?: string;
  diagnosis_text?: string;
  summary_source?: "llm" | "rule";
  extracted_fields?: Record<string, unknown>;
  combined_text: string;
  warnings: string[];
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  let response: Response;

  // CSRF 토큰 추출 및 헤더 구성
  const csrfToken = getCookie("csrftoken");
  const csrfHeader: Record<string, string> = {};
  if (
    csrfToken &&
    options.method &&
    !["GET", "HEAD", "OPTIONS", "TRACE"].includes(options.method.toUpperCase())
  ) {
    csrfHeader["X-CSRFToken"] = csrfToken;
  }

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: isFormData
        ? { ...csrfHeader, ...options.headers }
        : {
            "Content-Type": "application/json",
            ...csrfHeader,
            ...options.headers,
          },
      ...options,
    });
  } catch {
    throw new ApiRequestError(
      "Django API에 연결할 수 없습니다. 서버 실행 상태와 VITE_API_BASE_URL을 확인해주세요.",
      0,
      "NETWORK_ERROR",
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = readEnvelopeError(payload);
    throw new ApiRequestError(
      apiError?.message ?? `API 요청에 실패했습니다. (${response.status})`,
      response.status,
      apiError?.code,
      apiError?.field_errors,
    );
  }

  return unwrapEnvelope<T>(payload);
}

function readEnvelopeError(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const error = (payload as ApiEnvelope<unknown>).error;
  return error && typeof error === "object" ? error : null;
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

export const api = {
  login(input: { email: string; password: string }) {
    return request<CurrentUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  signup(input: { email: string; password: string }) {
    return request<CurrentUser>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout() {
    return request<{ message: string }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  getMe() {
    return request<CurrentUser>("/api/auth/me", {
      method: "GET",
    });
  },

  changePassword(input: { current_password: string; new_password: string }) {
    return request<{ message: string }>("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteAccount(input: { password: string }) {
    return request<{ message: string }>("/api/auth", {
      method: "DELETE",
      body: JSON.stringify(input),
    });
  },

  getProfile() {
    return request<Record<string, unknown>>("/api/user/profile", {
      method: "GET",
    });
  },

  saveProfile(input: Record<string, unknown>) {
    return request<Record<string, unknown>>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  patchProfile(input: Record<string, unknown>) {
    return request<Record<string, unknown>>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  runStrategy(
    input: {
      announcement_text?: string | null;
      profile_only?: boolean;
      input_method?: "manual" | "pdf" | null;
      source_filename?: string | null;
      pdf_analysis_id?: string | null;
      pdf_summary_text?: string | null;
      pdf_extracted_fields?: Record<string, unknown> | null;
    },
    signal?: AbortSignal,
  ) {
    return request<StrategyRecord>("/api/strategy", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  },

  getMyStrategies() {
    return request<StrategyRecord[]>("/api/strategy/me", {
      method: "GET",
    });
  },

  getStrategy(strategyId: string) {
    return request<StrategyRecord>(`/api/strategy/${strategyId}`, {
      method: "GET",
    });
  },

  askChatbot(input: { question: string; session_id?: string | null }) {
    return request<{ answer: string; sources: string[]; session_id: string }>("/api/chatbot", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  analyzePdf(file: File) {
    const body = new FormData();
    body.append("file", file);

    return request<PdfAnalysisResponse>("/api/pdf/analyze", {
      method: "POST",
      body,
    });
  },
};
