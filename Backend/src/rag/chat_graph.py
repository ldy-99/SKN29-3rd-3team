'''
Chatbot 구현을 위한 langgraph 모델링
--> chat_CLI.py 로 실행
'''

import os
from typing import Annotated, TypedDict, Literal
import uuid
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage

# 💡 DuckDuckGo 검색 툴 임포트
from langchain_community.tools import DuckDuckGoSearchRun

# 기존 리트리버 모듈 활용
from retriever import search, format_source

load_dotenv()

# ── 설정 ─────────────────────────────────────────────────────────
K_PER_COLLECTION = 3
TOP_K = 5

llm = ChatOpenAI(model="gpt-5.4-nano", temperature=0)
classifier_llm = ChatOpenAI(model="gpt-5.4-nano", temperature=0)

# 💡 DuckDuckGo 검색 인스턴스 생성
web_search_tool = DuckDuckGoSearchRun()


# ── 대화형 State 정의 ───────────────────────────────────────────
class ChatRAGState(TypedDict, total=False):
    messages: Annotated[list, add_messages]  # 대화 기록 축적
    query_type: str                         # "cheongyak" | "general" | "out_of_scope"
    retrieved: list                         # 검색 결과 상위 청크
    min_distance: float                     # 최소 유사도 거리
    found: bool                             # Threshold 통과 여부
    context: str                            # RAG용 내부 DB 컨텍스트
    sources: list[dict]                     # 출처 및 거리 정보


# ── 1. classify_query (대화 맥락 반영 버전으로 수정) ───────────────────

# 💡 ChatPromptTemplate.from_template 대신 .from_messages를 사용하여 대화 흐름을 주입합니다.
CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """이전 대화 맥락과 사용자의 최신 질문을 종합적으로 바탕으로, 최신 질문의 의도를 아래 3가지 중 하나로 분류하세요.
특히 "그럼 거기서", "그 조건은"과 같은 지시 대명사가 포함되어 있다면 이전 대화 내용을 참고하여 유추해야 합니다.

- cheongyak: 한국 주택청약 제도의 구체적인 규정, 자격조건, 소득기준, 가점, 특별공급, 전매제한 및 특정 아파트 단지의 분양 일정/모집공고 등 실시간 웹 조회가 필요한 청약 관련 질문
- general: "청약이 뭐야", "청약통장이 뭐야" 같은 아주 기초적인 정의/개념 질문으로 일반 지식으로 답변 가능한 질문
- out_of_scope: 청약 도메인과 전혀 상관없는 세금(양도소득세, 취득세 등), 소송 및 재판, 단순 부동산 시세 폭등/폭락 전망, 전문 법률 자문 등 완전히 범위를 벗어나는 질문

분류 결과를 정확히 다음 단어 중 하나로만 답하세요: cheongyak, general, out_of_scope"""),
    ("placeholder", "{messages}")  # 💡 메모리에 쌓인 대화 역사(Chat History)가 여기에 플러그인됩니다.
])

_classify_chain = CLASSIFY_PROMPT | classifier_llm | StrOutputParser()


def classify_query(state: ChatRAGState) -> ChatRAGState:
    # 💡 최신 한 문장만 잘라내지 않고, 대화 덩어리(state["messages"])를 통째로 전달합니다.
    raw = _classify_chain.invoke({"messages": state["messages"]}).strip().lower()

    if "out_of_scope" in raw:
        query_type = "out_of_scope"
    elif "general" in raw:
        query_type = "general"
    else:
        query_type = "cheongyak"

    return {"query_type": query_type}


def route_after_classify(state: ChatRAGState) -> Literal["retrieve", "general_answer", "out_of_scope_answer"]:
    if state["query_type"] == "general":
        return "general_answer"
    if state["query_type"] == "out_of_scope":
        return "out_of_scope_answer"
    return "retrieve"

# ── 2. retrieve (문서 검색 노드 - 검색어 압축 기능 탑재 버전) ──

# 💡 이전 대화 기록을 벡터 DB용 독립 키워드 검색어로 변환하는 프롬프트
QUERY_CONDENSE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """이전 대화 기록과 사용자의 최신 질문을 바탕으로, 벡터 데이터베이스(ChromaDB)에서 관련 정보를 검색하기 위한 최적의 '독립된 청약 검색 쿼리(키워드 중심)'를 한 줄로 생성하세요.
"거기서", "그 조건은", "일때는" 과 같은 지시 대명사나 생략된 주어를 앞선 맥락을 바탕으로 구체적인 청약 용어(예: 신혼부부 특별공급 맞벌이 소득기준)로 완전히 복원해야 합니다.
검색어는 키워드 중심으로 한 줄로만 작성하세요. 마크다운이나 문장 형태로 작성하지 마세요.
검색어 외에 다른 부연 설명이나 인사말은 절대 하지 마세요."""),
    ("placeholder", "{messages}")
])

_condense_chain = QUERY_CONDENSE_PROMPT | classifier_llm | StrOutputParser()


def retrieve(state: ChatRAGState) -> ChatRAGState:
    # 💡 1. 날것의 질문 대신, 메모리를 읽어 LLM이 맥락을 채워준 '압축된 검색어'를 생성합니다.
    search_query = _condense_chain.invoke({"messages": state["messages"]}).strip()

    # 디버깅용 터미널 출력
    print(f"\n[system] memory-based search query: '{search_query}'")

    # 💡 2. 변환된 고품질 키워드 쿼리로 로컬 ChromaDB 검색 실행!
    result = search(search_query)

    results = result["results"]
    min_distance = result["min_distance"] if result["min_distance"] is not None else 999.0

    context_parts = []
    sources = []
    for dist, doc, meta, col_name in results:
        label = format_source(meta, col_name)
        context_parts.append(f"[출처: {label}]\n{doc}")
        sources.append({"label": label, "distance": round(dist, 4)})

    context = "\n\n---\n\n".join(context_parts)

    return {
        "retrieved": results,
        "min_distance": min_distance,
        "context": context,
        "sources": sources,
        "found": result["found"],
    }

# 💡 내부 DB 검색결과 유무에 따른 웹 검색 라우팅 제어
def route_after_retrieve(state: ChatRAGState) -> Literal["generate_rag", "web_search"]:
    if state["found"]:
        return "generate_rag"
    return "web_search"  # 발견 못 하면 고정 멘트 대신 웹 검색 노드로 라우팅


# ── 3. generate_rag (내부 DB 기반 답변 생성 노드) ───────────────────
RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 대한민국 주택 청약 제도 전문가입니다.
아래 [Context]의 내용에만 기반하여 사용자의 질문에 정확하게 답변하세요.
이전 대화 맥락이 주어지면, 맥락을 고려하여 일관성 있게 답변하세요.

규칙:
- 문서에 나와있지 않은 금액, 비율, 숫자, 기간을 임의로 가공하거나 지어내지 마세요.
- 소득 기준, 비율, 기간 등 수치 데이터가 있다면 표나 불릿 포인트로 정리하세요.
- 여러 출처에 상충되는 정보가 있다면 최신 자료(source_year가 큰 쪽)를 우선하고, 그 사실을 답변에 명시하세요.
- 각 출처는 [출처: ...] 형태로 Context에 표시되어 있습니다. 답변 본문에서 직접 [출처: ...]를 인용할 필요는 없습니다.
- Context에서 답을 찾을 수 없는 세부사항은 "제공된 자료에서는 확인할 수 없습니다"라고 명시하세요.
- 마크다운 헤더(#, ##)는 절대 사용하지 마세요. ###만 허용합니다.
- 답변 마지막에 추가 질문을 유도하는 멘트("더 궁금하신 점이 있으면~" 등)를 넣지 마세요.
- 핵심 정보만 간결하게 전달하세요. 불필요한 부연 설명과 세부 단계 나열은 생략하세요.
- 단순한 질문은 3~5줄로 간결하게, 복잡한 질문은 필요한 만큼 상세하게 답변하세요.

[Context]
{context}"""),
    ("placeholder", "{messages}")
])


def generate_rag(state: ChatRAGState) -> ChatRAGState:
    chain = RAG_PROMPT | llm
    response = chain.invoke({
        "context": state["context"],
        "messages": state["messages"]
    })
    return {"messages": [response]}


# ── 4. web_search (💡 모르는 질문 발생 시 DuckDuckGo 웹 검색 노드) ──
WEB_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 대한민국 주택 청약 제도 전문가입니다.
내부 데이터베이스(ChromaDB)에서 정확한 기준을 찾지 못해, 실시간 웹 검색 결과를 제공받았습니다.
제공된 [Web Search Results]를 바탕으로 사용자의 질문에 친절하고 정확하게 답변해 주세요.

규칙:
- 실시간 웹 검색 내용에 기반하여 답변하되, 검색 결과에 없는 정보를 임의로 지어내지 마세요.
- 최신 부동산 대책이나 분양 공고 정보일 수 있으므로 맥락을 살려 답변하되, 최종 판단 전 '청약Home 공식 공고문'을 교차 확인하라는 안내 멘트를 포함하세요.
- 검색 결과에서도 유의미한 답을 찾을 수 없는 경우 "웹 검색을 통해서도 정확한 정보를 확인하기 어렵습니다"라고 답변하세요.
- 마크다운 헤더(#, ##)는 절대 사용하지 마세요. ###만 허용합니다.
- 답변 마지막에 추가 질문을 유도하는 멘트("더 궁금하신 점이 있으면~" 등)를 넣지 마세요.
- 핵심 정보만 간결하게 전달하세요. 불필요한 부연 설명과 세부 단계 나열은 생략하세요.
- 답변은 5줄 이내로 작성하세요. 더 자세한 내용은 사용자가 요청할 때만 제공하세요.

[Web Search Results]
{web_context}"""),
    ("placeholder", "{messages}")
])


def web_search(state: ChatRAGState) -> ChatRAGState:
    # 유저의 최신 질문 추출
    user_messages = [m for m in state["messages"] if isinstance(m, HumanMessage)]
    question = user_messages[-1].content if user_messages else ""

    print(f"\n[system] internal DB search missed; running web search: '{question}'")

    try:
        # DuckDuckGo 웹 검색 실행
        web_results = web_search_tool.invoke(question)
    except Exception as e:
        print(f"[system] web search failed: {e}")
        web_results = "실시간 웹 검색 결과가 일시적으로 제한되었습니다."

    # 검색된 웹 컨텍스트 주입 후 LLM 답변 빌드
    chain = WEB_PROMPT | llm
    response = chain.invoke({
        "web_context": web_results,
        "messages": state["messages"]
    })

    # CLI UI 출처 표기용 데이터 갱신
    web_sources = [{"label": "DuckDuckGo 웹 실시간 검색 결과", "distance": 0.0}]

    return {"messages": [response], "sources": web_sources , "context": f"[실시간 웹 검색 근거 자료]\n{web_results}"}


# ── 5. general_answer (일반 정의 답변 노드) ───────────────────────────
GENERAL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 대한민국 주택 청약 제도 전문가입니다.
사용자가 청약과 관련된 기초적인 정의나 개념을 물어봤습니다.
일반적으로 알려진 정확한 정보를 바탕으로 간결하게 설명하세요.

세부 수치(소득기준, 가점 점수, 전매제한 기간 등)처럼 자주 바뀌는 정보는
"정확한 수치는 최신 입주자모집공고문이나 청약Home에서 확인하시는 것이 좋습니다"라고
안내하고, 임의의 숫자를 단정적으로 제시하지 마세요.
- 마크다운 헤더(#, ##)는 절대 사용하지 마세요. ###만 허용합니다.
- 답변 마지막에 추가 질문을 유도하는 멘트("더 궁금하신 점이 있으면~" 등)를 넣지 마세요.
- 핵심 정보만 간결하게 전달하세요. 불필요한 부연 설명과 세부 단계 나열은 생략하세요.
- 답변은 5줄 이내로 작성하세요. 더 자세한 내용은 사용자가 요청할 때만 제공하세요."""),
    ("placeholder", "{messages}")
])


def general_answer(state: ChatRAGState) -> ChatRAGState:
    chain = GENERAL_PROMPT | llm
    response = chain.invoke({"messages": state["messages"]})
    return {"messages": [response], "sources": []}


# ── 6. out_of_scope_answer (권한 밖 대답 노드) ─────────────────────────
def out_of_scope_answer(state: ChatRAGState) -> ChatRAGState:
    answer = AIMessage(
        content="죄송합니다. 이 질문은 현재 보유한 자료(주택공급에 관한 규칙, "
                "주택청약 FAQ, 업무매뉴얼, LH 분양가이드, 청약Home 안내)의 범위를 "
                "벗어나는 내용입니다.\n\n"
                "세금(양도소득세 등)이나 법률 자문이 필요한 경우 세무사 또는 "
                "법무사 등 전문가와 상담하시는 것을 권장합니다."
    )
    return {"messages": [answer], "sources": []}


# ── 그래프 빌드 및 메모리Saver 결합 ───────────────────────────────
def build_chat_graph():
    graph = StateGraph(ChatRAGState)

    # 노드 등록 (기존 no_context 대신 web_search 노드를 배치)
    graph.add_node("classify_query", classify_query)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate_rag", generate_rag)
    graph.add_node("web_search", web_search)  # 💡 웹 검색 노드 추가
    graph.add_node("general_answer", general_answer)
    graph.add_node("out_of_scope_answer", out_of_scope_answer)

    graph.set_entry_point("classify_query")

    # 조건부 엣지 매핑
    graph.add_conditional_edges(
        "classify_query",
        route_after_classify,
        {
            "retrieve": "retrieve",
            "general_answer": "general_answer",
            "out_of_scope_answer": "out_of_scope_answer",
        },
    )

    graph.add_conditional_edges(
        "retrieve",
        route_after_retrieve,
        {
            "generate_rag": "generate_rag",
            "web_search": "web_search",  # 💡 웹 검색 연결
        },
    )

    graph.add_edge("generate_rag", END)
    graph.add_edge("web_search", END)     # 💡 웹 검색 후 대화 루프 종료
    graph.add_edge("general_answer", END)
    graph.add_edge("out_of_scope_answer", END)

    # 영속성 메모리 디바이스 결합
    memory = MemorySaver()
    return graph.compile(checkpointer=memory)
