export type ProgressStage = {
  title: string;
  currentStep: number;
  progressPercent: number;
};

export function getPdfUploadStage(elapsedSeconds: number): ProgressStage {
  // Backend progress events are not exposed yet, so the bar is an elapsed-time estimate per visible stage.
  if (elapsedSeconds < 5) {
    return {
      title: "PDF 파일을 확인하고 있습니다",
      currentStep: 0,
      progressPercent: Math.min(12 + elapsedSeconds * 4, 32),
    };
  }

  if (elapsedSeconds < 28) {
    return {
      title: "본문과 표를 추출하고 있습니다",
      currentStep: 1,
      progressPercent: Math.min(35 + (elapsedSeconds - 5) * 2, 84),
    };
  }

  return {
    title: "추출 결과를 정리하고 있습니다",
    currentStep: 2,
    progressPercent: Math.min(86 + Math.floor((elapsedSeconds - 28) * 0.5), 96),
  };
}

export function getStrategyRunningStage(elapsedSeconds: number): ProgressStage {
  if (elapsedSeconds < 10) {
    return {
      title: "프로필과 입력 정보를 확인하고 있습니다",
      currentStep: 0,
      progressPercent: Math.min(15 + elapsedSeconds * 3, 42),
    };
  }

  if (elapsedSeconds < 35) {
    return {
      title: "청약 조건과 공급 유형을 비교하고 있습니다",
      currentStep: 1,
      progressPercent: Math.min(45 + (elapsedSeconds - 10) * 1.5, 82),
    };
  }

  return {
    title: "맞춤 전략을 생성하고 있습니다",
    currentStep: 2,
    progressPercent: Math.min(84 + Math.floor((elapsedSeconds - 35) * 0.4), 96),
  };
}
