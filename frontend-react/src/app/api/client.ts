import profileFixture from "../fixtures/profile-basic-p0.json";
import strategyFixture from "../fixtures/strategy-response-partial.json";
import pdfFixture from "../fixtures/pdf-analyze-response-needs-review.json";

export type ApiEnvelope<T> = {
  data: T | null;
  error: null | {
    code: string;
    message: string;
    field_errors?: Record<string, unknown>;
  };
  request_id?: string;
};

type RequestOptions = RequestInit & {
  mockData?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false";

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { mockData, headers, ...fetchOptions } = options;

  if (USE_MOCK_API && mockData !== undefined) {
    await delay(350);
    return unwrapMock<T>(mockData);
  }

  try {
    const isFormData = fetchOptions.body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      headers: isFormData
        ? headers
        : {
            "Content-Type": "application/json",
            ...headers,
          },
      ...fetchOptions,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `API request failed: ${response.status}`);
    }

    return unwrapMock<T>(payload);
  } catch (error) {
    if (mockData !== undefined) {
      console.warn(`[mock fallback] ${endpoint}`, error);
      await delay(250);
      return unwrapMock<T>(mockData);
    }
    throw error;
  }
}

function unwrapMock<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const api = {
  login(input: { email: string; password: string }) {
    return request<{ user_id: string; email: string; name: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
      mockData: { user_id: "mock-user", email: input.email, name: "홍길동" },
    });
  },

  signup(input: { email: string; password: string }) {
    return request<{ user_id: string; email: string; name: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
      mockData: { user_id: "mock-user", email: input.email, name: "홍길동" },
    });
  },

  logout() {
    return request<null>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
      mockData: null,
    });
  },

  getProfile() {
    return request<typeof profileFixture>("/api/user/profile", {
      method: "GET",
      mockData: profileFixture,
    });
  },

  saveProfile(input: Record<string, unknown>) {
    return request<{ profile_id: string; updated_at: string }>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(input),
      mockData: {
        profile_id: "11111111-1111-1111-1111-111111111111",
        updated_at: new Date().toISOString(),
      },
    });
  },

  patchProfile(input: Record<string, unknown>) {
    return request<{ profile_id: string; updated_at: string }>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
      mockData: {
        profile_id: "11111111-1111-1111-1111-111111111111",
        updated_at: new Date().toISOString(),
      },
    });
  },

  runStrategy(input: { announcement_text?: string | null; profile_only?: boolean }) {
    return request<typeof strategyFixture.data>("/api/strategy", {
      method: "POST",
      body: JSON.stringify(input),
      mockData: strategyFixture,
    });
  },

  getMyStrategies() {
    return request<Array<typeof strategyFixture.data>>("/api/strategy/me", {
      method: "GET",
      mockData: { data: [strategyFixture.data], error: null },
    });
  },

  getStrategy(strategyId: string) {
    return request<typeof strategyFixture.data>(`/api/strategy/${strategyId}`, {
      method: "GET",
      mockData: strategyFixture,
    });
  },

  askChatbot(input: { message: string; strategy_id?: string }) {
    return request<{ answer: string; sources: string[] }>("/api/chatbot", {
      method: "POST",
      body: JSON.stringify(input),
      mockData: {
        data: {
          answer:
            "현재 입력된 프로필과 전략 결과 기준으로 답변합니다. 소득 정보가 비어 있어 일부 특별공급 판단은 제한될 수 있습니다.",
          sources: ["청약 가점 기준", "모집공고 주요 조건"],
        },
        error: null,
      },
    });
  },

  analyzePdf(file?: File) {
    const body = new FormData();
    if (file) body.append("file", file);

    return request<typeof pdfFixture.data>("/api/pdf/analyze", {
      method: "POST",
      headers: {},
      body,
      mockData: pdfFixture,
    });
  },
};
