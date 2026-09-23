"""Render and validate the seven generated mission-report PDFs.

Run after `pnpm test:mission-reports -- --output`.
"""

from __future__ import annotations

import json
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw
from pypdf import PdfReader


SOURCE = Path("output/pdf")
RENDER_ROOT = Path("tmp/pdfs/mission-report-qa")
REQUIRED_TEXT = (
    "UBND TỈNH TÂY NINH",
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Số: .../BC-SCT",
    "BÁO CÁO MINH HỌA",
    "Kính gửi: Ủy ban nhân dân tỉnh Tây Ninh",
    "Quyết định số 05/2025/QĐ-UBND",
    "Nghị định số 30/2020/NĐ-CP",
    "GIÁM ĐỐC",
    "Câu hỏi điều hành cần quyết định",
    "ĐÁNH GIÁ GIÁ TRỊ ĐẦU TƯ NỀN TẢNG",
    "NHIỆM VỤ, GIẢI PHÁP VÀ KIẾN NGHỊ",
    "KIỂM SOÁT CHẤT LƯỢNG VÀ GIỚI HẠN SỬ DỤNG",
    "PHỤ LỤC",
)

EXPECTED_BY_TASK = {
    1: (
        "Tình hình năng lực cung cấp điện, vận hành lưới và nhu cầu ưu tiên đầu tư hạ tầng",
        "Luật Điện lực số 61/2024/QH15",
    ),
    2: (
        "Tình hình phát triển nguồn năng lượng tái tạo, sản lượng và khả năng giải tỏa công suất",
        "Dự án nào cần tháo gỡ thủ tục hoặc hạ tầng đấu nối?",
    ),
    3: (
        "Tình hình phát triển điện mặt trời mái nhà, mức tự dùng và tiềm năng khai thác",
        "Chỉ thị số 10/CT-TTg",
    ),
    4: (
        "Tình hình sử dụng năng lượng, nghĩa vụ báo cáo và tiềm năng tiết kiệm tại các cơ sở",
        "Luật số 77/2025/QH15",
    ),
    5: (
        "Hiện trạng dữ liệu an toàn điện, vi phạm hành lang lưới và kịch bản điều hành xử lý",
        "Vụ việc nào quá hạn xử lý hoặc tái diễn?",
    ),
    6: (
        "Hiện trạng dữ liệu phục vụ kiểm kê khí nhà kính ngành năng lượng và tiến độ chuẩn hóa",
        "Nghị định số 119/2025/NĐ-CP",
        "không dùng để báo cáo pháp lý",
    ),
    7: (
        "Hiện trạng dữ liệu và kịch bản phát triển hạ tầng trạm sạc xe điện, độ phủ, nhu cầu công suất",
        "Quyết định số 876/QĐ-TTg",
        "Tọa độ, công suất, đầu sạc và snapshot hiện là kịch bản",
    ),
}


def assert_pdf(task_id: int, pdf_path: Path) -> dict[str, object]:
    reader = PdfReader(pdf_path)
    assert not reader.is_encrypted, f"NV{task_id}: PDF must not be encrypted"
    extracted = [(page.extract_text() or "") for page in reader.pages]
    combined = "\n".join(extracted)
    normalized = " ".join(combined.split())
    assert "\x00" not in combined, f"NV{task_id}: embedded font produces NUL text"
    assert "\ufffd" not in combined, f"NV{task_id}: replacement glyph found"
    for phrase in REQUIRED_TEXT:
        assert phrase in normalized, f"NV{task_id}: missing required text: {phrase}"
    for phrase in EXPECTED_BY_TASK[task_id]:
        assert phrase in normalized, f"NV{task_id}: missing task-specific text: {phrase}"

    appendix_page = next(
        (index for index, page_text in enumerate(extracted) if "PHỤ LỤC" in page_text),
        None,
    )
    assert appendix_page is not None, f"NV{task_id}: appendix page not found"

    render_dir = RENDER_ROOT / f"nhiem-vu-{task_id}"
    render_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    page_images: list[Path] = []
    out_of_bounds: list[dict[str, object]] = []
    for index, page in enumerate(doc):
        width, height = page.rect.width, page.rect.height
        is_portrait = height > width
        assert is_portrait == (index < appendix_page), (
            f"NV{task_id} page {index + 1}: main report must be portrait and appendix landscape"
        )
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if x0 < -1 or y0 < -1 or x1 > width + 1 or y1 > height + 1:
                out_of_bounds.append(
                    {"page": index + 1, "box": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)]}
                )
        image_path = render_dir / f"page-{index + 1:02d}.png"
        page.get_pixmap(matrix=pymupdf.Matrix(1.35, 1.35), alpha=False).save(image_path)
        page_images.append(image_path)
    assert not out_of_bounds, f"NV{task_id}: text outside page: {out_of_bounds[:3]}"

    thumbnails: list[Image.Image] = []
    thumb_width = 320
    for page_image in page_images:
        with Image.open(page_image) as image:
            thumbnail = image.convert("RGB")
            thumbnail.thumbnail((thumb_width, 430))
            framed = Image.new("RGB", (thumb_width + 16, thumbnail.height + 34), "#e2e8f0")
            framed.paste(thumbnail, ((framed.width - thumbnail.width) // 2, 8))
            draw = ImageDraw.Draw(framed)
            draw.text((8, framed.height - 20), page_image.stem, fill="#0f172a")
            thumbnails.append(framed)
    columns = 3
    rows = (len(thumbnails) + columns - 1) // columns
    row_height = max(image.height for image in thumbnails) + 8
    sheet = Image.new("RGB", (columns * (thumb_width + 24), rows * row_height), "white")
    for index, thumbnail in enumerate(thumbnails):
        sheet.paste(thumbnail, ((index % columns) * (thumb_width + 24), (index // columns) * row_height))
    contact_sheet = render_dir / "contact-sheet.png"
    sheet.save(contact_sheet)

    return {
        "taskId": task_id,
        "pages": len(reader.pages),
        "appendixStartsAt": appendix_page + 1,
        "textCharacters": len(combined),
        "renderDirectory": str(render_dir),
        "contactSheet": str(contact_sheet),
    }


def main() -> None:
    RENDER_ROOT.mkdir(parents=True, exist_ok=True)
    results = []
    for task_id in range(1, 8):
        pdf_path = SOURCE / f"bao-cao-nhiem-vu-{task_id}-so-cong-thuong-tay-ninh.pdf"
        assert pdf_path.exists(), f"Missing generated PDF: {pdf_path}"
        results.append(assert_pdf(task_id, pdf_path))
    print(json.dumps({"ok": True, "reports": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
