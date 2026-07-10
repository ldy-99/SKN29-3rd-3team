import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT / "Backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.pdf_service import _extract_notice_fields


def test_applyhome_schedule_without_split_priority_maps_winner_date():
    text = """
    거제 푸르지오 마린피스 입주자모집공고
    주택유형 해당지역 기타지역 규제지역여부
    민영 경상남도 거제시 거주자 부산광역시 및 울산광역시, 경상남도 거주자 비규제지역
    구분 입주자모집공고일 특별공급 접수일 일반공급 1순위 접수일 일반공급 2순위 접수일 당첨자발표일 서류접수 계약체결
    일정 26.07.07(화) 26.07.20(월) 26.07.21(화) 26.07.22(수) 26.07.29(수)
    26.08.01(토)~ 26.08.07(금) 26.08.11(화)~ 26.08.13(목)
    01 084.6886 84 84.6886 27.5115 112.2001 45.4919 157.6920 26.1149 268 27 27 40 8 19 27 148 120 4
    02 105.1765 105 105.1765 29.4343 134.6108 56.4973 191.1081 32.4326 33 - 3 - 1 - - 4 29 -
    03 107.4383 107 107.4383 28.8641 136.3024 57.7122 194.0146 33.1301 122 - 12 - 4 - - 16 106 4
    2층 2 154,947,000 256,053,000 - 411,000,000 5,000,000 36,100,000 41,100,000 123,300,000
    30층~ 36층 7 224,645,580 371,231,291 37,123,129 633,000,000 5,000,000 58,300,000 63,300,000 189,900,000
    """

    fields = _extract_notice_fields("2026000253 거제 푸르지오 마린피스 입주자모집공고문.pdf", text)

    assert fields["regulated_area"] == "비규제지역"
    assert fields["schedule"]["first_priority"] == "2026.07.21"
    assert fields["schedule"]["second_priority"] == "2026.07.22"
    assert fields["schedule"]["winner_announcement"] == "2026.07.29"
    assert fields["schedule"]["document_submission"] == "2026.08.01 ~ 2026.08.07"
    assert fields["schedule"]["contract_period"] == "2026.08.11 ~ 2026.08.13"
    assert [item["type"] for item in fields["housing_types"]] == ["84", "105", "107"]
    assert fields["price_summary"]["min_krw"] == 411_000_000
    assert fields["price_summary"]["max_krw"] == 633_000_000


def test_lh_national_rental_notice_is_marked_out_of_scope():
    text = """
    의왕시 지역 국민임대주택 예비입주자 모집
    입주자 모집공고일 [2026.07.06.], 주택관리번호 [2026-000322]
    이 주택은 분양전환 되지 않는 공공임대주택으로 입주자격 충족 시 최장 30년간 거주 가능합니다.
    단지명 단 지 위 치 건설호수 최초입주
    의왕내손 경기도 의왕시 갈미1로 22 (내손동 791) 8개동 822호 '03.07.
    세대당 계약면적(㎡) 단지명 주택형 주거전용 모집할 예비자수
    의왕내손 51 51.49 80
    의왕내손 59 59.64 10
    임대조건
    51A 21,567,000 1,078,350 20,488,650 288,210
    59 24,977,000 1,248,850 23,728,150 339,220
    """

    fields = _extract_notice_fields("{공고문(PDF)}_의왕시지역국민임대주택예비입주자모집공고문.pdf", text)

    assert fields["announcement_name"] == "의왕시 지역 국민임대주택"
    assert fields["notice_kind"] == "국민임대주택"
    assert fields["housing_category"] == "공공임대주택"
    assert "진단 범위 밖" in fields["support_note"]
    assert fields["announcement_date"] == "2026.07.06"
    assert fields["location"] == "경기도 의왕시 갈미1로 22 (내손동 791)"
    assert [item["type"] for item in fields["housing_types"]] == ["51", "59"]
    assert fields["rent_summary"]["deposit_max_krw"] == 24_977_000
    assert fields["rent_summary"]["monthly_rent_max_krw"] == 339_220


def test_lh_public_rental_conversion_notice_extracts_front_page_facts():
    text = """
    군포대야미지구 A-1블록 6년 분양전환공공임대주택 입주자모집공고
    ❚공급위치 : 경기도 군포시 대야미동, 속달동, 둔대동 일원 군포대야미 공공주택지구내 A-1블록
    ❚공급대상 : 6년 분양전환 공공임대주택 378세대 [전용면적 55㎡ 52세대, 59㎡ 326세대]
    이 주택의 입주자모집공고일은 2026.06.30(화)이며, 이는 청약자격의 판단기준일이 됩니다.
    1. 공급규모
    군포대야미지구 A-1블록 : 6년 분양전환공공임대주택 12~27층 5개동 전용면적 60㎡이하 378세대 (사전청약 229세대, 일반공급 7세대, 특별공급 141세대)
    """

    fields = _extract_notice_fields("군포대야미A-1블록6년분양전환공공임대주택입주자모집공고문.pdf", text)

    assert fields["notice_kind"] == "분양전환공공임대주택"
    assert fields["housing_category"] == "공공임대주택"
    assert fields["location"].startswith("경기도 군포시 대야미동")
    assert fields["announcement_date"] == "2026.06.30"
    assert fields["supply_summary"]["total_households"] == 378
    assert fields["supply_summary"]["general_supply_households"] == 7
    assert fields["supply_summary"]["special_supply_households"] == 141
    assert [item["type"] for item in fields["housing_types"]] == ["55", "59"]


def test_lh_unsold_sale_notice_uses_clean_title_location_and_type():
    text = """
    영천해피포유 미분양매입 잔여세대 선착순 일반매각 공고
    ❚공급대상 : 영천해피포유 공가세대 총 55세대
    단지 공급호수(호) 전용면적(㎡) 주소
    영천해피포유 55 84.68 경북 영천시 고경면 방천길 30
    Ⅰ 공급대상 및 공급가격 등
    101 101 84.6824 25.5005 110.1829 1.8724 112.0553 106,500,000 10,650,000 95,850,000
    101 503 84.6824 25.4918 110.1742 1.8624 112.0366 113,500,000 11,350,000 102,150,000
    """

    fields = _extract_notice_fields("공고문_영천해피포유미분양매입잔여세대선착순일반매각공고.pdf", text)

    assert fields["announcement_name"] == "영천해피포유"
    assert fields["notice_kind"] == "미분양 매각/선착순 공급"
    assert fields["location"] == "경북 영천시 고경면 방천길 30"
    assert fields["supply_summary"]["total_households"] == 55
    assert fields["housing_types"][0]["type"] == "84"
    assert fields["price_summary"]["min_krw"] == 106_500_000
    assert fields["price_summary"]["max_krw"] == 113_500_000
