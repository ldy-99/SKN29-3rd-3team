import { ApiRequestError } from "./client";

export type ErrorPresentation = {
  title: string;
  message: string;
  details: string[];
};

const codeMessages: Record<string, { title: string; message: string }> = {
  PROFILE_REQUIRED: {
    title: "프로필 저장 필요",
    message: "전략 진단 전에 내 청약 조건을 입력하고 저장해주세요.",
  },
  PROFILE_REQUIRED_FIELDS_MISSING: {
    title: "필수 프로필 항목 확인",
    message: "전략 진단에 필요한 프로필 항목이 비어 있습니다.",
  },
  ANNOUNCEMENT_CONFIRMATION_REQUIRED: {
    title: "공고문 확인 필요",
    message: "분석한 공고문 내용 중 확인이 필요한 항목이 있습니다.",
  },
  NETWORK_ERROR: {
    title: "서버 연결 실패",
    message: "Django 서버에 연결할 수 없습니다. 서버 실행 상태와 API 주소를 확인해주세요.",
  },
};

const statusMessages: Record<number, { title: string; message: string }> = {
  400: { title: "입력 내용 확인", message: "입력한 내용 중 확인이 필요한 항목이 있습니다." },
  401: { title: "로그인 필요", message: "로그인 세션이 만료되었거나 인증 정보가 없습니다." },
  403: { title: "접근 권한 없음", message: "이 요청을 실행할 권한이 없습니다." },
  404: { title: "데이터를 찾을 수 없음", message: "요청한 정보가 없거나 삭제되었습니다." },
  409: { title: "중복 또는 충돌", message: "이미 존재하는 정보이거나 현재 상태와 충돌합니다." },
  413: { title: "파일 크기 초과", message: "업로드한 파일이 허용 크기를 초과했습니다." },
  422: { title: "입력값 검증 실패", message: "입력 형식과 필수 항목을 다시 확인해주세요." },
  502: { title: "분석 서버 응답 지연", message: "AI 분석 서버가 정상 응답하지 않았습니다. 잠시 후 다시 시도해주세요." },
  503: { title: "서비스 일시 중단", message: "현재 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요." },
  504: { title: "분석 시간 초과", message: "분석 서버의 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요." },
};

export function getErrorPresentation(
  error: unknown,
  fallbackMessage = "요청을 처리하지 못했습니다.",
): ErrorPresentation {
  if (typeof error === "string") {
    return { title: "확인 필요", message: error, details: [] };
  }

  if (!(error instanceof ApiRequestError)) {
    return {
      title: "처리 실패",
      message: error instanceof Error ? error.message : fallbackMessage,
      details: [],
    };
  }

  const fieldDetails = flattenFieldErrors(error.fieldErrors);
  if (fieldDetails.length > 0) {
    const [primaryFieldError, ...remainingFieldErrors] = fieldDetails;
    const separatorIndex = primaryFieldError.indexOf(": ");
    const fieldLabel =
      separatorIndex >= 0 ? primaryFieldError.slice(0, separatorIndex) : "입력 내용";
    const fieldMessage =
      separatorIndex >= 0
        ? primaryFieldError.slice(separatorIndex + 2)
        : primaryFieldError;

    return {
      title: fieldLabel === "요청" ? "입력 내용 확인" : `${fieldLabel} 확인`,
      message: fieldMessage,
      details: remainingFieldErrors,
    };
  }

  const codeMapped = error.code ? codeMessages[error.code] : undefined;
  const statusMapped = statusMessages[error.status];
  const mapped =
    codeMapped ??
    statusMapped ??
    (error.status >= 500
      ? { title: "서버 처리 오류", message: "서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }
      : { title: "요청 처리 실패", message: error.message || fallbackMessage });

  return {
    title: mapped.title,
    message: mapped.message,
    details: [],
  };
}

function flattenFieldErrors(
  fieldErrors?: Record<string, unknown>,
): string[] {
  if (!fieldErrors) return [];

  return Object.entries(fieldErrors).flatMap(([field, value]) => {
    const label = fieldLabels[field] ?? field;
    const messages = Array.isArray(value) ? value : [value];
    return messages
      .map((message) => stringifyMessage(message))
      .filter(Boolean)
      .map((message) => `${label}: ${message}`);
  });
}

function stringifyMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(stringifyMessage)
      .filter(Boolean)
      .join(", ");
  }
  return value == null ? "" : String(value);
}

const fieldLabels: Record<string, string> = {
  email: "이메일",
  password: "비밀번호",
  username: "사용자 이름",
  announcement_text: "공고문",
  profile: "프로필",
  non_field_errors: "요청",
};
