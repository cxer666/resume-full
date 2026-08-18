import html
import json
import mimetypes
import os
import re
import shutil
import sys
import time
import traceback
import uuid
import webbrowser
import zipfile
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from xml.etree import ElementTree


def get_app_root():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


APP_ROOT = get_app_root()
WEB_ROOT = APP_ROOT / "web"
DATA_DIR = APP_ROOT / "data"
UPLOAD_DIR = APP_ROOT / "uploads"
SITE_DIR = APP_ROOT / "generated_site"
STORE_PATH = DATA_DIR / "resume_store.json"
HOST = "127.0.0.1"
PORT = 17888
FLOATING_STATE = {"enabled": False, "updatedAt": 0.0}


DEFAULT_STORE = {
    "activeVersion": "通用版",
    "versions": {
        "通用版": {
            "profile": {
                "name": "",
                "gender": "",
                "phone": "",
                "email": "",
                "location": "",
                "school": "",
                "major": "",
                "degree": "",
                "graduation": "",
                "targetRole": "",
                "summary": "",
                "skills": "",
                "internships": "",
                "projects": "",
                "education": "",
                "portfolio": "",
                "github": "",
                "expectedCity": "",
                "expectedSalary": "",
                "availability": "",
                "awards": "",
                "languages": "",
                "aiAbility": "",
                "aiTools": "",
                "aiProjects": "",
                "aiLinks": "",
                "rawText": "",
                "photo": "",
                "video": "",
                "noInternship": False,
                "noProject": False,
                "noAwards": False,
                "projectItems": [],
                "internshipItems": [],
                "awardItems": [],
                "languageItems": [],
                "customItems": [],
            },
            "sources": [],
            "updatedAt": "",
        }
    },
    "updatedAt": "",
}


FIELD_ALIASES = {
    "name": ["姓名", "名字", "name", "full name", "真实姓名", "应聘者姓名"],
    "gender": ["性别", "gender"],
    "phone": ["手机号", "手机", "电话", "联系电话", "联系方式", "phone", "mobile", "tel"],
    "email": ["邮箱", "电子邮箱", "邮件", "email", "mail"],
    "location": ["现居", "所在地", "居住地", "地址", "location", "address"],
    "school": ["学校", "院校", "毕业院校", "就读学校", "university", "college", "school"],
    "major": ["专业", "major"],
    "degree": ["学历", "学位", "degree", "education level"],
    "graduation": ["毕业时间", "毕业年份", "graduation"],
    "targetRole": ["求职意向", "目标岗位", "应聘岗位", "岗位", "position", "role"],
    "summary": ["自我评价", "个人总结", "个人优势", "summary", "profile"],
    "skills": ["技能", "专业技能", "技能特长", "skills"],
    "internships": ["实习", "实习经历", "工作经历", "实践经历", "experience", "work"],
    "projects": ["项目", "项目经历", "作品集", "project", "portfolio"],
    "education": ["教育经历", "教育背景", "education"],
    "portfolio": ["作品链接", "作品集链接", "个人网站", "portfolio", "website"],
    "github": ["github", "代码仓库", "仓库"],
    "expectedCity": ["期望城市", "意向城市", "工作城市"],
    "expectedSalary": ["期望薪资", "薪资", "salary"],
    "availability": ["到岗", "到岗时间", "入职时间", "availability"],
    "awards": ["获奖", "荣誉", "奖项", "证书", "award", "honor", "certificate"],
    "languages": ["语言", "英语", "四六级", "四级", "六级", "cet", "ielts", "toefl", "language"],
    "aiAbility": ["AI", "人工智能", "大模型", "AI应用", "AI工具", "Cursor", "Copilot", "DeepSeek", "Claude"],
}


def ensure_dirs():
    DATA_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    SITE_DIR.mkdir(exist_ok=True)
    if not STORE_PATH.exists():
        save_store(DEFAULT_STORE)



def get_floating_state():
    return {"enabled": bool(FLOATING_STATE["enabled"]), "updatedAt": FLOATING_STATE["updatedAt"]}


def set_floating_state(enabled):
    FLOATING_STATE["enabled"] = bool(enabled)
    FLOATING_STATE["updatedAt"] = time.time()
    return get_floating_state()


def now_text():return time.strftime("%Y-%m-%d %H:%M:%S")


def load_store():
    ensure_dirs()
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return json.loads(json.dumps(DEFAULT_STORE, ensure_ascii=False))


def save_store(store):
    store["updatedAt"] = now_text()
    STORE_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")


def active_profile(store):
    active = store.get("activeVersion") or "通用版"
    versions = store.setdefault("versions", {})
    if active not in versions:
        versions[active] = json.loads(json.dumps(DEFAULT_STORE["versions"]["通用版"], ensure_ascii=False))
    return versions[active]["profile"]


def normalize_text(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_txt(path):
    raw = Path(path).read_bytes()
    for enc in ("utf-8-sig", "utf-8", "gb18030", "gbk", "utf-16"):
        try:
            return normalize_text(raw.decode(enc))
        except UnicodeDecodeError:
            continue
    return normalize_text(raw.decode("utf-8", errors="ignore"))


def parse_docx(path):
    chunks = []
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    for para in root.findall(".//w:p", ns):
        texts = [node.text or "" for node in para.findall(".//w:t", ns)]
        if texts:
            chunks.append("".join(texts))
    return normalize_text("\n".join(chunks))


def parse_pdf(path):
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(path)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if text.strip():
            return normalize_text(text)
    except Exception:
        pass

    data = Path(path).read_bytes()
    matches = re.findall(rb"\(([^()]{2,500})\)", data)
    decoded = []
    for item in matches:
        try:
            decoded.append(item.decode("utf-8"))
        except UnicodeDecodeError:
            try:
                decoded.append(item.decode("gb18030"))
            except UnicodeDecodeError:
                decoded.append(item.decode("latin1", errors="ignore"))
    return normalize_text("\n".join(decoded))


def parse_resume_file(path):
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return parse_txt(path)
    if suffix == ".docx":
        return parse_docx(path)
    if suffix == ".pdf":
        return parse_pdf(path)
    raise ValueError("暂不支持该文件格式，请选择 txt / docx / pdf")


def pick_first(patterns, text, flags=re.I):
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return match.group(1).strip(" ：:，,;；\n\t")
    return ""



def compact_heading(text):
    return re.sub(r"[\s:：,，、;；·•\-—_（）()\[\]【】0-9一二三四五六七八九十]+", "", text or "").lower()


def remove_heading_prefix(line, keywords):
    value = (line or "").strip()
    for _ in range(3):
        changed = False
        for keyword in keywords:
            escaped = re.escape(keyword)
            if len(keyword) <= 2:
                pattern = rf"^\s*{escaped}\s*(?:[-_—·•]?[0-9一二三四五六七八九十]+|[:：,，、;；\-—])\s*"
            else:
                pattern = rf"^\s*{escaped}\s*(?:[-_—·•]?[0-9一二三四五六七八九十]+)?\s*[:：,，、;；\-—]?\s*"
            next_value = re.sub(pattern, "", value, flags=re.I).strip()
            if next_value != value:
                value = next_value
                changed = True
        if not changed:
            break
    return value


def strip_section_heading(section, keywords):
    lines = []
    for raw in (section or "").splitlines():
        line = raw.strip()
        if not line:
            if lines:
                lines.append("")
            continue
        cleaned = remove_heading_prefix(line, keywords)
        if not cleaned and not lines:
            continue
        if cleaned:
            lines.append(cleaned)
    return normalize_text("\n".join(lines))


def looks_like_section_heading(line, current_keywords):
    compact = compact_heading(line)
    if not compact or len(line.strip()) >= 24:
        return False
    current = [compact_heading(item) for item in current_keywords]
    if any(item and item in compact for item in current):
        return False
    stop_sections = [
        "教育经历", "教育背景", "教育", "项目经历", "项目经验", "项目实践", "实习经历", "实习经验", "工作经历", "实践经历", "在校经历",
        "专业技能", "技能特长", "技能", "自我评价", "个人评价", "个人总结", "个人优势",
        "荣誉证书", "获奖信息", "获奖经历", "奖项证书", "证书", "语言水平", "语言能力",
        "英语能力", "AI应用技能", "AI能力", "人工智能", "求职意向", "目标岗位",
    ]
    return any(compact_heading(item) in compact for item in stop_sections)


def section_after(text, keywords, max_chars=900):
    lines = [line.strip() for line in text.splitlines()]
    result = []
    capture = False
    for line in lines:
        if not line:
            if capture:
                result.append("")
            continue
        lower = line.lower()
        if any(k.lower() in lower for k in keywords):
            capture = True
            result.append(line)
            continue
        if capture and looks_like_section_heading(line, keywords):
            break
        if capture:
            result.append(line)
        if len("\n".join(result)) > max_chars:
            break
    return strip_section_heading(normalize_text("\n".join(result))[:max_chars], keywords)


def is_item_marker(line, words):
    raw = (line or "").strip()
    compact = compact_heading(raw)
    if not compact:
        return False
    for word in words:
        if compact.startswith(compact_heading(word)) and re.search(r"(?:\d+|[一二三四五六七八九十])$", compact):
            return True
    return bool(re.match(r"^\s*(?:\d+|[一二三四五六七八九十]+)[\.．、)）]\s*\S+", raw))


def split_item_blocks(section, marker_words):
    blocks = []
    current = []
    for raw in (section or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if is_item_marker(line, marker_words):
            if current:
                blocks.append(current)
            current = []
            continue
        if current and re.match(r"^\s*(?:项目名称|公司|实习公司|单位|奖项名称|语言\s*/?\s*证书)\s*[:：]", line):
            blocks.append(current)
            current = [line]
            continue
        current.append(line)
    if current:
        blocks.append(current)
    return blocks


def normalize_date_value(value):
    value = (value or "").strip()
    value = value.replace("年", ".").replace("月", "")
    value = re.sub(r"[/-]", ".", value)
    return value.strip(" .")


def extract_date_range(text):
    date = r"(?:20\d{2}|19\d{2})(?:[./\-年]\d{1,2})?(?:月)?|至今|现在|present|Present"
    match = re.search(rf"({date})\s*(?:-|–|—|~|至|到)\s*({date})", text or "", re.I)
    if not match:
        return "", "", False, text or ""
    start = normalize_date_value(match.group(1))
    end_raw = match.group(2)
    current = bool(re.search(r"至今|现在|present", end_raw, re.I))
    end = "" if current else normalize_date_value(end_raw)
    cleaned = ((text or "")[:match.start()] + (text or "")[match.end():]).strip(" ｜|,，;；-— ")
    return start, end, current, cleaned



TIMELINE_START_RE = re.compile(
    r"^\s*((?:20\d{2}|19\d{2})(?:[./\-年]\d{1,2})?(?:月)?)"
    r"(?:\s*(?:-|–|—|~|至|到)\s*((?:20\d{2}|19\d{2})(?:[./\-年]\d{1,2})?(?:月)?|至今|现在|present|Present))?"
    r"\s+(.+)$",
    re.I,
)


def is_timeline_start(line):
    return bool(TIMELINE_START_RE.match(line or ""))


def extract_leading_date_title(line):
    match = TIMELINE_START_RE.match(line or "")
    if not match:
        return "", "", False, (line or "").strip()
    start = normalize_date_value(match.group(1))
    end_raw = (match.group(2) or "").strip()
    current = bool(re.search(r"至今|现在|present", end_raw, re.I))
    end = "" if current else normalize_date_value(end_raw)
    title = (match.group(3) or "").strip(" ｜|,，;；-— ")
    return start, end, current, title


def split_timeline_blocks(section):
    blocks = []
    current = []
    heading_words = ["在校经历", "实习经验", "实习经历", "工作经历", "实践经历", "项目经验", "项目经历", "项目实践"]
    for raw in (section or "").splitlines():
        line = remove_heading_prefix(raw.strip(), heading_words).strip()
        if not line:
            continue
        if is_timeline_start(line):
            if current:
                blocks.append(current)
            current = [line]
        elif current:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def split_company_role(title):
    title = (title or "").strip()
    match = re.match(r"^(.+?(?:有限公司|公司|集团|工作室|中心|实验室))\s+(.+)$", title)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    if re.search(r"实习生|工程师|测试|开发|运营|产品|助理|专员|QA", title, re.I):
        return "", title
    return title, ""


def is_internship_title(title):
    title = title or ""
    if re.search(r"(?:有限公司|公司|集团|工作室).*(?:实习|岗位|测试|开发|运营|产品|工程师|助理|专员|QA)", title, re.I):
        return True
    return bool(re.search(r"实习生|实习岗位|工作经历", title, re.I))


def timeline_items_from_section(section):
    project_items = []
    internship_items = []
    for lines in split_timeline_blocks(section):
        start, end, current, title = extract_leading_date_title(lines[0])
        if not title:
            continue
        description = clean_description_lines(lines[1:])
        if is_internship_title(title):
            company, role = split_company_role(title)
            internship_items.append({
                "company": company,
                "role": role,
                "startDate": start,
                "endDate": end,
                "current": current,
                "description": description,
            })
        else:
            project_items.append({
                "name": title,
                "role": "",
                "startDate": start,
                "endDate": end,
                "current": current,
                "description": description,
            })
    return project_items, internship_items


def dedupe_structured_items(items, key_fields):
    result = []
    seen = set()
    for item in items or []:
        if not item_has_content(item):
            continue
        key = "|".join(str(item.get(field, "")).strip() for field in key_fields)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def format_date_range(start, end, current=False):
    if start and current:
        return f"{start}-至今"
    if start and end:
        return f"{start}-{end}"
    return start or end or ""


def format_project_items_text(items):
    parts = []
    for item in items or []:
        lines = []
        if item.get("name"):
            lines.append(f"项目名称：{item['name']}")
        date = format_date_range(item.get("startDate"), item.get("endDate"), item.get("current"))
        if date:
            lines.append(f"项目时间：{date}")
        if item.get("role"):
            lines.append(f"角色：{item['role']}")
        if item.get("description"):
            lines.append(f"描述：{item['description']}")
        if lines:
            parts.append("\n".join(lines))
    return normalize_text("\n\n".join(parts))


def format_internship_items_text(items):
    parts = []
    for item in items or []:
        lines = []
        if item.get("company"):
            lines.append(f"公司：{item['company']}")
        if item.get("role"):
            lines.append(f"职位：{item['role']}")
        date = format_date_range(item.get("startDate"), item.get("endDate"), item.get("current"))
        if date:
            lines.append(f"实习时间：{date}")
        if item.get("description"):
            lines.append(f"描述：{item['description']}")
        if lines:
            parts.append("\n".join(lines))
    return normalize_text("\n\n".join(parts))


def trim_at_timeline_after_intro(section):
    kept = []
    for raw in (section or "").splitlines():
        line = raw.strip()
        if kept and is_timeline_start(line):
            break
        kept.append(raw)
    return normalize_text("\n".join(kept))


def extract_language_text(text):
    heading_section = section_after(text, ["语言水平", "语言能力", "英语水平", "英语能力", "外语水平"], 700)
    lines = []
    if heading_section:
        lines.extend(heading_section.splitlines())
    for raw in (text or "").splitlines():
        line = raw.strip()
        if re.search(r"(?:英语)?(?:四级|六级)|CET-?4|CET-?6|雅思|托福|IELTS|TOEFL|普通话|日语N[1-5]", line, re.I):
            lines.append(line)
    result = []
    seen = set()
    for line in lines:
        cleaned = remove_heading_prefix(line.strip(), ["语言水平", "语言能力", "英语水平", "英语能力", "外语水平", "证书"])
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return normalize_text("\n".join(result))

def after_label(line, labels):
    for label in labels:
        match = re.match(rf"^\s*{re.escape(label)}\s*[:：]\s*(.+)$", line or "", re.I)
        if match:
            return match.group(1).strip()
    return ""


def strip_description_label(line):
    return re.sub(r"^\s*(?:描述|项目描述|工作描述|职责描述|工作内容|项目内容|奖项说明|补充说明)\s*[:：]\s*", "", line or "").strip()


def clean_description_lines(lines):
    cleaned = []
    for line in lines:
        value = strip_description_label(line).strip()
        if not value:
            continue
        cleaned.append(value)
    return normalize_text("\n".join(cleaned))


def parse_project_items(section):
    items = []
    for lines in split_item_blocks(section, ["项目经历", "项目经验", "项目"]):
        item = {"name": "", "role": "", "startDate": "", "endDate": "", "current": False, "description": ""}
        desc = []
        for line in lines:
            name = after_label(line, ["项目名称", "项目", "名称"])
            role = after_label(line, ["在项目中担任的角色", "担任角色", "项目角色", "角色", "职责"])
            time_value = after_label(line, ["起止时间", "项目时间", "时间", "日期"])
            if name:
                start, end, current, cleaned = extract_date_range(name)
                item["name"] = cleaned or name
                item["startDate"] = item["startDate"] or start
                item["endDate"] = item["endDate"] or end
                item["current"] = item["current"] or current
                continue
            if role:
                item["role"] = role
                continue
            if time_value:
                start, end, current, _ = extract_date_range(time_value)
                item["startDate"] = item["startDate"] or start or time_value
                item["endDate"] = item["endDate"] or end
                item["current"] = item["current"] or current
                continue
            start, end, current, without_date = extract_date_range(line)
            if start and not item["startDate"]:
                item["startDate"] = start
                item["endDate"] = end
                item["current"] = current
                line = without_date or line
            if not item["name"] and not re.match(r"^[-•·*]", line) and len(line) <= 42:
                item["name"] = strip_description_label(line)
            else:
                desc.append(line)
        item["description"] = clean_description_lines(desc)
        if any(str(value).strip() for key, value in item.items() if key != "current"):
            items.append(item)
    return items


def parse_internship_items(section):
    items = []
    for lines in split_item_blocks(section, ["实习经历", "工作经历", "实践经历", "实习", "工作"]):
        item = {"company": "", "role": "", "startDate": "", "endDate": "", "current": False, "description": ""}
        desc = []
        for line in lines:
            company = after_label(line, ["公司", "实习公司", "公司名称", "单位", "企业"])
            role = after_label(line, ["职位", "岗位", "职务", "实习岗位", "担任职位"])
            time_value = after_label(line, ["起止时间", "实习时间", "工作时间", "时间", "日期"])
            if company:
                item["company"] = company
                continue
            if role:
                item["role"] = role
                continue
            if time_value:
                start, end, current, _ = extract_date_range(time_value)
                item["startDate"] = item["startDate"] or start or time_value
                item["endDate"] = item["endDate"] or end
                item["current"] = item["current"] or current
                continue
            start, end, current, without_date = extract_date_range(line)
            if start and not item["startDate"]:
                item["startDate"] = start
                item["endDate"] = end
                item["current"] = current
                line = without_date or line
            if not item["company"] and re.search(r"公司|集团|科技|网络|工作室|中心|实验室|有限公司", line) and len(line) <= 48:
                item["company"] = strip_description_label(line)
            elif not item["role"] and re.search(r"实习|测试|开发|运营|产品|工程师|助理|专员|QA", line, re.I) and len(line) <= 32:
                item["role"] = strip_description_label(line)
            else:
                desc.append(line)
        item["description"] = clean_description_lines(desc)
        if any(str(value).strip() for key, value in item.items() if key != "current"):
            items.append(item)
    return items


def parse_award_items(section):
    items = []
    for lines in split_item_blocks(section, ["获奖信息", "获奖经历", "奖项", "证书", "荣誉"]):
        item = {"type": "", "name": "", "date": "", "description": ""}
        desc = []
        for line in lines:
            kind = after_label(line, ["获奖类型", "类型", "奖项类型"])
            name = after_label(line, ["奖项名称", "奖项", "证书名称", "荣誉名称", "名称"])
            date_value = after_label(line, ["获奖时间", "时间", "日期"])
            if kind:
                item["type"] = kind
            elif name:
                item["name"] = name
            elif date_value:
                item["date"] = normalize_date_value(date_value)
            elif not item["name"] and len(line) <= 50:
                item["name"] = strip_description_label(line)
            else:
                desc.append(line)
        item["description"] = clean_description_lines(desc)
        if any(str(value).strip() for value in item.values()):
            items.append(item)
    return items


def parse_language_items(section):
    items = []
    for line in [item.strip() for item in re.split(r"[\n;；]+", section or "") if item.strip()]:
        item = {"name": "", "level": "", "score": "", "date": "", "description": ""}
        score = pick_first([r"(?:分数|成绩)\s*[:：]?\s*(\d{3})", r"\b(\d{3})\b"], line, 0)
        if score:
            item["score"] = score
        if re.search(r"六级|CET-?6", line, re.I):
            item["name"] = "英语六级"
            item["level"] = "CET-6"
        elif re.search(r"四级|CET-?4", line, re.I):
            item["name"] = "英语四级"
            item["level"] = "CET-4"
        else:
            item["name"] = remove_heading_prefix(line, ["语言", "语言水平", "语言能力"])[:40]
        item["description"] = line if line != item["name"] else ""
        if any(str(value).strip() for value in item.values()):
            items.append(item)
    return items


def item_has_content(item):
    return any(str(value).strip() for key, value in (item or {}).items() if key != "current")


def merge_items(old_items, new_items):
    old_items = old_items if isinstance(old_items, list) else []
    old_items = [item for item in old_items if item_has_content(item)]
    new_items = [item for item in (new_items or []) if item_has_content(item)]
    if not old_items:
        return new_items, bool(new_items)
    seen = {json.dumps(item, ensure_ascii=False, sort_keys=True) for item in old_items}
    merged = list(old_items)
    changed = False
    for item in new_items:
        key = json.dumps(item, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            merged.append(item)
            seen.add(key)
            changed = True
    return merged, changed


def extract_profile(text):
    compact = re.sub(r"\s+", " ", text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email = pick_first([r"([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})"], text, 0)
    phone = pick_first([r"((?:\+?86[- ]?)?1[3-9]\d{9})"], compact, 0)
    name = ""
    for line in lines[:10]:
        cleaned = re.sub(r"[|｜·•\-\s]+", "", line)
        if cleaned in ("个人简历", "求职简历", "简历"):
            continue
        if 2 <= len(cleaned) <= 5 and re.search(r"^[\u4e00-\u9fa5]{2,5}$", cleaned):
            name = cleaned
            break
    if not name:
        name = pick_first([r"姓名[:： ]{0,3}([\u4e00-\u9fa5]{2,5})"], text)

    school = ""
    for candidate in re.findall(r"([\u4e00-\u9fa5A-Za-z0-9]{2,30}(?:大学|学院|学校)(?:[（(][\u4e00-\u9fa5A-Za-z0-9]+[）)])?)", text):
        if candidate.startswith(("参与", "负责", "协助")):
            continue
        if candidate.endswith("学校") and len(candidate) <= 4:
            continue
        school = candidate
        break
    major = pick_first([r"专业[:： ]{0,3}([\u4e00-\u9fa5A-Za-z0-9（）()]{2,30})"], text)
    degree = pick_first([r"(本科|硕士|研究生|博士|大专|专科)"], text)
    graduation = pick_first([r"(20\d{2}[./年-]?\d{0,2})\s*(?:毕业|届|年毕业)?"], text)

    summary = trim_at_timeline_after_intro(section_after(text, ["自我评价", "个人总结", "个人优势"], 700))
    skills = section_after(text, ["专业技能", "技能特长"], 800)
    internships = section_after(text, ["实习经历", "实习经验", "工作经历", "实践经历"], 1800)
    projects = section_after(text, ["项目经历", "项目经验", "项目实践", "作品集"], 1800)
    education = section_after(text, ["教育经历", "教育背景"], 900)
    edu_start, edu_end, edu_current, _ = extract_date_range(education)
    if edu_end:
        graduation = edu_end
    awards = section_after(text, ["获奖信息", "获奖经历", "荣誉证书", "奖项证书", "奖学金", "竞赛获奖"], 900)
    languages = extract_language_text(text)
    ai_ability = section_after(text, ["AI应用技能", "AI能力", "AI工具", "大模型", "Cursor", "Copilot", "DeepSeek", "Claude"], 900)

    timeline_project_items = []
    timeline_internship_items = []
    for timeline_section in [projects, internships]:
        parsed_projects, parsed_internships = timeline_items_from_section(timeline_section)
        timeline_project_items.extend(parsed_projects)
        timeline_internship_items.extend(parsed_internships)

    project_items = dedupe_structured_items(timeline_project_items, ["name", "startDate", "endDate"]) or parse_project_items(projects)
    internship_items = dedupe_structured_items(timeline_internship_items, ["company", "role", "startDate", "endDate"]) or parse_internship_items(internships)
    if project_items:
        projects = format_project_items_text(project_items)
    if internship_items:
        internships = format_internship_items_text(internship_items)
    award_items = parse_award_items(awards)
    language_items = parse_language_items(languages)

    profile = {
        "name": name,
        "gender": pick_first([r"性别[:： ]{0,3}(男|女)"], text),
        "phone": phone,
        "email": email,
        "location": pick_first([r"(?:现居|所在地|地址)[:： ]{0,3}([\u4e00-\u9fa5A-Za-z0-9 -]{2,30})"], text),
        "school": school,
        "major": major,
        "degree": degree,
        "graduation": graduation,
        "targetRole": pick_first([r"(?:求职意向|目标岗位|应聘岗位)[:： ]{0,3}(.{2,40})"], text),
        "summary": summary,
        "skills": skills,
        "internships": internships,
        "projects": projects,
        "education": education,
        "portfolio": pick_first([r"(https?://[^\s，。；;]+)"], text, 0),
        "github": pick_first([r"(https?://github\.com/[^\s，。；;]+)"], text, 0),
        "expectedCity": "",
        "expectedSalary": "",
        "availability": "",
        "awards": awards,
        "languages": languages,
        "aiAbility": ai_ability,
        "aiTools": "",
        "aiProjects": "",
        "aiLinks": "",
        "projectItems": project_items,
        "internshipItems": internship_items,
        "awardItems": award_items,
        "languageItems": language_items,
        "rawText": text,
    }
    return profile

def merge_profile(old, new):
    merged = dict(old)
    changed = []
    for key, value in new.items():
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
        if not value:
            continue
        if isinstance(value, list):
            merged_items, list_changed = merge_items(merged.get(key), value)
            if list_changed:
                merged[key] = merged_items
                changed.append({"field": key, "type": "merged", "value": f"{len(value)} 条"})
            continue
        old_value = str(merged.get(key, "") or "").strip()
        if not old_value:
            merged[key] = value
            changed.append({"field": key, "type": "added", "value": value})
        elif key in ("skills", "projects", "internships", "education", "summary", "awards", "languages", "aiAbility", "aiTools", "aiProjects", "aiLinks", "rawText"):
            if value not in old_value:
                merged[key] = normalize_text(old_value + "\n\n" + value)
                changed.append({"field": key, "type": "merged", "value": value[:120]})
        elif old_value != value:
            changed.append({"field": key, "type": "conflict", "old": old_value, "new": value})
    return merged, changed


def read_multipart(body, content_type):
    boundary_match = re.search(r"boundary=(.+)", content_type)
    if not boundary_match:
        raise ValueError("缺少 multipart boundary")
    boundary = ("--" + boundary_match.group(1).strip('"')).encode()
    parts = body.split(boundary)
    fields = {}
    files = []
    for part in parts:
        if not part or part in (b"--\r\n", b"--"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        header_raw, _, value = part.partition(b"\r\n\r\n")
        if not header_raw:
            continue
        value = value.rstrip(b"\r\n-")
        headers = header_raw.decode("utf-8", errors="ignore")
        name = pick_first([r'name="([^"]+)"'], headers, 0)
        filename = pick_first([r'filename="([^"]*)"'], headers, 0)
        if filename:
            files.append((name, filename, value))
        elif name:
            fields[name] = value.decode("utf-8", errors="ignore")
    return fields, files


def safe_filename(name):
    name = unquote(name).replace("\\", "_").replace("/", "_")
    return re.sub(r"[^A-Za-z0-9._\-\u4e00-\u9fa5]", "_", name)[:120] or "upload.bin"


def render_resume_site(profile):
    name = html.escape(profile.get("name") or "个人简历")
    role = html.escape(profile.get("targetRole") or "求职者")
    photo = profile.get("photo") or ""
    video = profile.get("video") or ""

    def block(title, value):
        value = html.escape(value or "").replace("\n", "<br>")
        if not value:
            value = "待补充"
        return f'<section class="card reveal"><h2>{html.escape(title)}</h2><p>{value}</p></section>'

    photo_html = f'<img class="avatar" src="../{html.escape(photo)}" alt="avatar">' if photo else '<div class="avatar placeholder">照片</div>'
    video_html = f'<video controls src="../{html.escape(video)}"></video>' if video else ""
    skills = [s.strip() for s in re.split(r"[、,，;\n ]+", profile.get("skills", "")) if s.strip()]
    skill_html = "".join(f"<span>{html.escape(s)}</span>" for s in skills[:40]) or "<span>待补充</span>"

    page = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{name} - 个人简历</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin:0; font-family: 'Microsoft YaHei', Arial, sans-serif; color:#1f2937; background:#f5f7fb; }}
    .hero {{ min-height: 46vh; padding: 56px 8vw 42px; display:flex; align-items:center; gap:36px; background:linear-gradient(135deg,#0f766e,#2563eb); color:white; overflow:hidden; }}
    .hero::after {{ content:''; position:absolute; width:360px; height:360px; right:-90px; top:-120px; border-radius:50%; background:rgba(255,255,255,.12); animation: float 7s ease-in-out infinite; }}
    .avatar {{ width:150px; height:150px; border-radius:22px; object-fit:cover; border:4px solid rgba(255,255,255,.45); box-shadow:0 20px 60px rgba(0,0,0,.25); background:#e5e7eb; display:grid; place-items:center; color:#64748b; }}
    h1 {{ margin:0; font-size:44px; letter-spacing:0; }}
    .role {{ font-size:20px; opacity:.92; margin-top:10px; }}
    .contact {{ margin-top:18px; line-height:1.8; opacity:.95; }}
    main {{ width:min(1060px,92vw); margin:-34px auto 60px; display:grid; grid-template-columns:1fr 1fr; gap:18px; }}
    .card {{ background:white; border:1px solid #e5e7eb; border-radius:8px; padding:22px; box-shadow:0 12px 34px rgba(15,23,42,.08); }}
    .wide {{ grid-column:1 / -1; }}
    h2 {{ margin:0 0 12px; font-size:20px; color:#0f766e; }}
    p {{ margin:0; line-height:1.8; white-space:normal; }}
    .skills {{ display:flex; flex-wrap:wrap; gap:8px; }}
    .skills span {{ padding:7px 10px; border-radius:999px; background:#ecfeff; color:#0f766e; border:1px solid #a5f3fc; }}
    video {{ width:100%; max-height:420px; border-radius:8px; background:#111827; }}
    .reveal {{ animation: rise .55s ease both; }}
    @keyframes rise {{ from {{ opacity:0; transform:translateY(16px); }} to {{ opacity:1; transform:none; }} }}
    @keyframes float {{ 0%,100% {{ transform:translateY(0); }} 50% {{ transform:translateY(22px); }} }}
    @media (max-width: 760px) {{ .hero {{ flex-direction:column; align-items:flex-start; }} main {{ grid-template-columns:1fr; }} h1 {{ font-size:34px; }} }}
  </style>
</head>
<body>
  <header class="hero">
    {photo_html}
    <div>
      <h1>{name}</h1>
      <div class="role">{role}</div>
      <div class="contact">
        {html.escape(profile.get("phone") or "")}<br>
        {html.escape(profile.get("email") or "")}<br>
        {html.escape(profile.get("school") or "")} · {html.escape(profile.get("major") or "")}
      </div>
    </div>
  </header>
  <main>
    <section class="card wide"><h2>技能标签</h2><div class="skills">{skill_html}</div></section>
    {block("自我评价", profile.get("summary", ""))}
    {block("教育经历", profile.get("education", "") or "学校：" + (profile.get("school") or "") + "\\n专业：" + (profile.get("major") or "") + "\\n学历：" + (profile.get("degree") or ""))}
    {block("项目经历", profile.get("projects", ""))}
    {block("实习/实践经历", profile.get("internships", ""))}
    {block("获奖信息", profile.get("awards", ""))}
    {block("AI应用技能", profile.get("aiAbility", ""))}
    {block("语言水平", profile.get("languages", ""))}
    <section class="card wide"><h2>作品展示</h2>{video_html}<p>{html.escape(profile.get("portfolio") or "待补充作品集链接")}</p></section>
  </main>
</body>
</html>"""
    SITE_DIR.mkdir(exist_ok=True)
    index = SITE_DIR / "index.html"
    index.write_text(page, encoding="utf-8")
    return index


class Handler(SimpleHTTPRequestHandler):
    server_version = "ResumeAssistant/0.1"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(length)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/floating-state":
            self.send_json(get_floating_state())
            return
        if parsed.path == "/api/resume":
            self.send_json(load_store())
            return
        if parsed.path == "/api/fields":
            self.send_json({"aliases": FIELD_ALIASES})
            return
        if parsed.path == "/":
            self.path = "/index.html"
            return self.serve_from(WEB_ROOT)
        if parsed.path.startswith("/generated_site/"):
            rel = parsed.path.replace("/generated_site/", "", 1)
            return self.serve_file(SITE_DIR / rel)
        if parsed.path.startswith("/uploads/"):
            rel = parsed.path.replace("/uploads/", "", 1)
            return self.serve_file(UPLOAD_DIR / rel)
        return self.serve_from(WEB_ROOT)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/floating-state":
                body = self.read_body().decode("utf-8")
                payload = json.loads(body or "{}")
                state = set_floating_state(bool(payload.get("enabled")))
                self.send_json({"ok": True, **state})
                return
            if parsed.path == "/api/resume":
                payload = json.loads(self.read_body().decode("utf-8"))
                save_store(payload)
                self.send_json({"ok": True, "store": payload})
                return
            if parsed.path == "/api/import":
                content_type = self.headers.get("Content-Type", "")
                fields, files = read_multipart(self.read_body(), content_type)
                version = fields.get("version") or "通用版"
                if not files:
                    raise ValueError("没有收到简历文件")
                _, filename, data = files[0]
                saved = UPLOAD_DIR / f"{uuid.uuid4().hex}_{safe_filename(filename)}"
                saved.write_bytes(data)
                text = parse_resume_file(saved)
                parsed_profile = extract_profile(text)
                store = load_store()
                store["activeVersion"] = version
                versions = store.setdefault("versions", {})
                if version not in versions:
                    versions[version] = json.loads(json.dumps(DEFAULT_STORE["versions"]["通用版"], ensure_ascii=False))
                current = versions[version]["profile"]
                merged, changes = merge_profile(current, parsed_profile)
                versions[version]["profile"] = merged
                versions[version]["updatedAt"] = now_text()
                versions[version].setdefault("sources", []).append({"file": filename, "path": str(saved.relative_to(APP_ROOT)), "time": now_text()})
                save_store(store)
                self.send_json({"ok": True, "text": text, "parsed": parsed_profile, "changes": changes, "store": store})
                return
            if parsed.path == "/api/upload-media":
                content_type = self.headers.get("Content-Type", "")
                fields, files = read_multipart(self.read_body(), content_type)
                media_type = fields.get("type") or "photo"
                version = fields.get("version") or "通用版"
                if not files:
                    raise ValueError("没有收到媒体文件")
                _, filename, data = files[0]
                saved = UPLOAD_DIR / f"{uuid.uuid4().hex}_{safe_filename(filename)}"
                saved.write_bytes(data)
                store = load_store()
                store["activeVersion"] = version
                profile = active_profile(store)
                profile[media_type] = str(saved.relative_to(APP_ROOT)).replace("\\", "/")
                save_store(store)
                self.send_json({"ok": True, "path": profile[media_type], "store": store})
                return
            if parsed.path == "/api/generate-site":
                store = load_store()
                profile = active_profile(store)
                index = render_resume_site(profile)
                self.send_json({"ok": True, "url": f"http://{HOST}:{PORT}/generated_site/index.html", "path": str(index)})
                return
            raise FileNotFoundError(parsed.path)
        except Exception as exc:
            traceback.print_exc()
            self.send_json({"ok": False, "error": str(exc)}, status=500)

    def serve_from(self, root):
        parsed = urlparse(self.path)
        rel = parsed.path.lstrip("/") or "index.html"
        return self.serve_file(root / rel)

    def serve_file(self, path):
        path = Path(path).resolve()
        allowed = [WEB_ROOT.resolve(), UPLOAD_DIR.resolve(), SITE_DIR.resolve()]
        if not any(str(path).startswith(str(root)) for root in allowed):
            self.send_error(403)
            return
        if path.is_dir():
            path = path / "index.html"
        if not path.exists():
            self.send_error(404)
            return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    ensure_dirs()
    os.chdir(APP_ROOT)
    url = f"http://{HOST}:{PORT}/"
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 10048 or getattr(exc, "errno", None) in (48, 98):
            print(f"简历填写助手已在运行: {url}")
            if "--no-open" not in sys.argv:
                webbrowser.open(url)
            return
        raise
    print(f"简历填写助手已启动: {url}")
    if "--no-open" not in sys.argv:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("正在关闭...")

if __name__ == "__main__":
    main()
























