from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.parse
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PROGRAMS_DIR = ROOT / "img" / "programs"
FIELD_TRIP_DIR = ROOT / "img" / "FieldTrip"
XLSX_PATH = PROGRAMS_DIR / "Proj. Library.xlsx"
OUTPUT_PATH = ROOT / "projects-data.js"
AMAP_GEOCODE_CACHE_PATH = ROOT / "scripts" / "amap_geocode_cache.json"
MAPBOX_ACCESS_TOKEN = os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}

CLIENT_ALIASES = {
    "ACZ + 猜一建筑": ["ACZ + 猜一建筑", "Arc Z + 猜一建筑", "猜一建筑 + Arc Z"],
    "B.L.U.E": ["B.L.U.E", "B.L.U.E. 建筑设计事务所"],
    "Heatherwick": ["Heatherwick", "Heatherwick Studio"],
    "Jahn": ["Jahn", "/Jahn"],
    "Pelli Clarke&Partners": ["Pelli Clarke&Partners", "Pelli Clarke & Partners"],
    "安藤忠雄": ["安藤忠雄", "安藤忠雄建筑研究所"],
    "繁境建筑": ["繁境建筑", "矶崎新+胡倩工作室，繁境建筑"],
}

PROJECT_MATCH_OVERRIDES = {
    ("LEL Design Studio", "侨新老醋"): "永春侨新红粬醋观光工厂",
    ("LINDBERG", "港汇恒隆"): "港汇恒隆店",
    ("SHL", "深圳书城"): "深圳书城湾区之眼",
    ("SOM", "中化"): "中化大厦",
    ("SOM", "杭州望朝中心 Hangzhou Wangchao Center"): "望朝中心",
    ("SOM", "芯联"): "Top芯联科技办公园",
    ("内田上海建筑事务所", "亚麻博物馆"): "浙江亚麻博物馆",
    ("内田上海建筑事务所", "大连兼松"): "兼松商贸办公室",
    ("墨菲扬", "保利C+"): "保利C+国际博览中心",
    ("壹舍设计", "易成办公室"): "上海易成办公室",
    ("波士顿国际设计", "复旦附中"): "复旦附中徐汇分校",
    ("立木设计", "上海均匀"): "上海均匀设计",
    ("立木设计", "光禾作用"): "北京广渠门光禾作用",
    ("立木设计", "启东彭宅"): "彭宅",
    ("立木设计", "大零号湾"): "大零号湾行政服务中心",
    ("立木设计", "宝莉学校"): "宝莉斑马小学",
    ("立木设计", "汕头幼儿师范"): "汕头幼儿师范高等专科学校",
    ("立木设计", "铺头小学"): "晋城铺头小学",
    ("繁境建筑", "龙湖银泰"): "郑州龙湖金融岛/银泰inPARK",
    ("谢杰建筑事务所", "小公园"): "运光路小公园",
    ("阿科米星", "网易上海西岸研发中心"): "网易西岸研发中心",
    ("天空人", "上海长宁来福士店"): "天空人北京三里屯店,天空人北京国贸店,天空人长宁来福士店",
    ("天空人", "北京三里屯店"): "天空人北京三里屯店,天空人北京国贸店,天空人长宁来福士店",
    ("天空人", "北京国贸商城店"): "天空人北京三里屯店,天空人北京国贸店,天空人长宁来福士店",
}

FIELD_TRIP_MATCH_OVERRIDES = {
    "阿姆斯特丹Valley": "Valley",
    "哥本哈根copenhill": "CopenHill",
    "哥本哈根超线公园": "Superkilen",
    "因斯布鲁克缆车站": "Hungerburgbahn",
    "柏林SONY中心": "The Center Potsdamer Platz (The Sony Center)",
    "柏林德国国会大厦": "Reichstag Building",
    "柏林犹太人博物馆": "Berlin Jewish Museum",
    "海牙美术馆": "Hague Municipal Museum",
    "美国西部": "Views of the American West",
}

IMAGE_COVER_OVERRIDES = {
    ("", "美国西部"): "roadtripCBCO.webp",
    ("", "淀山湖渔村"): "_DSF1172.webp",
}

PROJECT_DISPLAY_OVERRIDES = {
    ("天空人", "上海长宁来福士店"): {
        "title": "天空人上海长宁来福士店",
        "titleEn": "SKYPEOPLE Changning Raffles City",
        "location": "上海",
        "locationEn": "Shanghai",
        "coordinates": [121.469102, 31.232344],
    },
    ("天空人", "北京三里屯店"): {
        "title": "天空人北京三里屯店",
        "titleEn": "SKYPEOPLE Sanlitun",
        "location": "北京",
        "locationEn": "Beijing",
        "coordinates": [116.454953, 39.938592],
    },
    ("天空人", "北京国贸商城店"): {
        "title": "天空人北京国贸店",
        "titleEn": "SKYPEOPLE China World Mall",
        "location": "北京",
        "locationEn": "Beijing",
        "coordinates": [116.458686, 39.912704],
    },
    ("合尘建筑", "扭转塔和螺旋站"): {
        "coordinates": [121.9668, 30.882],
    },
    ("合尘建筑", "海岸生态驿站"): {
        "coordinates": [121.9678, 30.8812],
    },
    ("OPEN Architecture", "油罐艺术中心"): {
        "coordinates": [121.46092, 31.16586],
    },
    ("合尘建筑", "上海西岸办公楼改造"): {
        "coordinates": [121.45874, 31.17002],
    },
    ("壹舍设计", "易成办公室"): {
        "coordinates": [121.49478, 31.20233],
    },
    ("本真设计", "上海信托办公室"): {
        "coordinates": [121.48491, 31.23779],
    },
    ("零几建筑", "上海赛艇公开赛 海泰展亭"): {
        "coordinates": [121.48482, 31.24594],
    },
    ("本真设计", "鸿商集团总部"): {
        "coordinates": [121.50574, 31.25238],
    },
    ("ACZ + 猜一建筑", "下水那天 THE LAUNCH"): {
        "coordinates": [121.55572, 31.27361],
    },
    ("谢杰建筑事务所", "小公园"): {
        "coordinates": [121.5128, 31.3031],
    },
}

LOCATION_OVERRIDES = {
    "衢州市龙游县龙翔路518号": "衢州",
    "陕西 西安万象城": "西安",
    "西安万象城": "西安",
    "安吉绿城桃花源": "安吉",
    "晋城市泽州县铺头村": "晋城",
    "上海东川公路2988": "上海",
    "北京 上海": "北京",
}

FIELD_TRIP_LOCATION_TRANSLATIONS = {
    "Merida, Mexico": ("梅里达", "Merida", [-89.6237, 20.9674]),
    "Gary, Indiana, USA": ("加里", "Gary", [-87.3464, 41.5934]),
    "Copenhagen, Denmark": ("哥本哈根", "Copenhagen", [12.5683, 55.6761]),
    "Copenhagen，Denmark": ("哥本哈根", "Copenhagen", [12.5683, 55.6761]),
    "大理大吉酒店": ("大理", "Dali", [100.1905, 25.6937]),
    "上海方塔园": ("上海", "Shanghai", [121.2275, 31.0026]),
    "昆明世博园": ("昆明", "Kunming", [102.7606, 25.0903]),
    "淀山湖一村": ("上海", "Shanghai", [121.0408, 31.0941]),
    "New Mexico, USA": ("新墨西哥", "New Mexico", [-106.0181, 34.5199]),
    "Berlin, Germany": ("柏林", "Berlin", [13.405, 52.52]),
    "Amsterdam, The Netherlands": ("阿姆斯特丹", "Amsterdam", [4.9041, 52.3676]),
    "Innsbruck, Austria": ("因斯布鲁克", "Innsbruck", [11.4041, 47.2692]),
    "The Hague, The Netherlands": ("海牙", "The Hague", [4.3007, 52.0705]),
}

FIELD_TRIP_CLIENT_OVERRIDES = {}

# 临时隐藏项目：需要恢复时直接从这里移除即可
TEMP_HIDDEN_PROJECT_KEYS = {
    ("SOM", "中化"),
}

LOCATION_METADATA = {
    "上海": {"locationEn": "Shanghai", "coordinates": [121.469102, 31.232344]},
    "南京": {"locationEn": "Nanjing", "coordinates": [118.796877, 32.060255]},
    "惠州": {"locationEn": "Huizhou", "coordinates": [114.41679, 23.111847]},
    "嘉兴": {"locationEn": "Jiaxing", "coordinates": [120.755486, 30.746129]},
    "深圳": {"locationEn": "Shenzhen", "coordinates": [114.057868, 22.543099]},
    "慈溪": {"locationEn": "Cixi", "coordinates": [121.266579, 30.169665]},
    "苏州": {"locationEn": "Suzhou", "coordinates": [120.585316, 31.298886]},
    "北京": {"locationEn": "Beijing", "coordinates": [116.407526, 39.90403]},
    "常州": {"locationEn": "Changzhou", "coordinates": [119.973987, 31.810689]},
    "成都": {"locationEn": "Chengdu", "coordinates": [104.066541, 30.572269]},
    "广州": {"locationEn": "Guangzhou", "coordinates": [113.264385, 23.129112]},
    "昌黎": {"locationEn": "Changli", "coordinates": [119.164541, 39.709729]},
    "西安": {"locationEn": "Xi'an", "coordinates": [108.93977, 34.341574]},
    "安吉": {"locationEn": "Anji", "coordinates": [119.680353, 30.638674]},
    "汕头": {"locationEn": "Shantou", "coordinates": [116.681956, 23.354152]},
    "厦门": {"locationEn": "Xiamen", "coordinates": [118.089425, 24.479834]},
    "潢川": {"locationEn": "Huangchuan", "coordinates": [115.050123, 32.131557]},
    "杭州": {"locationEn": "Hangzhou", "coordinates": [120.15507, 30.274084]},
    "启东": {"locationEn": "Qidong", "coordinates": [121.659724, 31.810158]},
    "晋城": {"locationEn": "Jincheng", "coordinates": [112.851831, 35.490701]},
    "衢州": {"locationEn": "Quzhou", "coordinates": [118.87263, 28.941708]},
    "永春": {"locationEn": "Yongchun", "coordinates": [118.294246, 25.321566]},
    "三亚": {"locationEn": "Sanya", "coordinates": [109.508268, 18.247872]},
    "雄安": {"locationEn": "Xiong'an", "coordinates": [115.973611, 38.994444]},
    "郑州": {"locationEn": "Zhengzhou", "coordinates": [113.625368, 34.7466]},
    "南昌": {"locationEn": "Nanchang", "coordinates": [115.858198, 28.682892]},
    "长沙": {"locationEn": "Changsha", "coordinates": [112.938814, 28.228209]},
    "大连": {"locationEn": "Dalian", "coordinates": [121.614682, 38.914003]},
}

APPROXIMATE_FEATURE_TYPES = {"country", "region", "place"}

ADDRESS_KEYWORD_COORDINATES = [
    {
        "keywords": ["杨高南路", "上海金融交易广场", "世纪大道"],
        "coordinates": [121.535252, 31.226962],
        "precision": "estimated",
    },
    {
        "keywords": ["斜土路2431", "徐汇区档案馆"],
        "coordinates": [121.447792, 31.193147],
        "precision": "estimated",
    },
    {
        "keywords": ["龙水南路99", "网易西岸研发中心", "龙腾大道2598"],
        "coordinates": [121.45435, 31.17752],
        "precision": "estimated",
    },
    {
        "keywords": ["凯滨路179", "复旦附中徐汇分校"],
        "coordinates": [121.452628, 31.183905],
        "precision": "estimated",
    },
    {
        "keywords": ["公平路18", "华侨大楼", "北外滩来福士"],
        "coordinates": [121.50448, 31.25211],
        "precision": "estimated",
    },
    {
        "keywords": ["世纪同框", "外白渡桥"],
        "coordinates": [121.493928, 31.247969],
        "precision": "estimated",
    },
    {
        "keywords": ["瑞虹天地", "飞虹路", "瑞虹路"],
        "coordinates": [121.498327, 31.265436],
        "precision": "estimated",
    },
    {
        "keywords": ["恒隆广场", "淮海中路138"],
        "coordinates": [121.458612, 31.224613],
        "precision": "estimated",
    },
    {
        "keywords": ["虹桥汇", "天山soho", "娄山关路", "虹桥"],
        "coordinates": [121.401341, 31.205126],
        "precision": "estimated",
    },
    {
        "keywords": ["复兴岛", "下水那天"],
        "coordinates": [121.568394, 31.276362],
        "precision": "estimated",
    },
    {
        "keywords": ["天安千树", "1000 Trees", "莫干山路600"],
        "coordinates": [121.438248, 31.245285],
        "precision": "estimated",
    },
    {
        "keywords": ["油罐艺术中心", "TANK Shanghai", "龙腾大道2380"],
        "coordinates": [121.459155, 31.177657],
        "precision": "estimated",
    },
    {
        "keywords": ["晶耀前滩", "Crystal Plaza", "耀体路308", "耀体路212"],
        "coordinates": [121.460798, 31.159665],
        "precision": "estimated",
    },
    {
        "keywords": ["深圳书城湾区之眼", "深圳书城湾区城", "Greater Bay Area Shenzhen Book City", "宝华站"],
        "coordinates": [113.879469, 22.551563],
        "precision": "estimated",
    },
    {
        "keywords": ["南汇嘴观海公园"],
        "coordinates": [121.977812, 30.889763],
        "precision": "estimated",
    },
    {
        "keywords": ["秋荷路50", "成山路718", "世纪汇2座", "世纪汇"],
        "coordinates": [121.527173, 31.229126],
        "precision": "estimated",
    },
    {
        "keywords": ["罗店路394", "MAX科技园"],
        "coordinates": [121.361265, 31.396323],
        "precision": "estimated",
    },
    {
        "keywords": ["元江路3883", "703媒体园区", "剑川路940", "电气文通"],
        "coordinates": [121.398474, 31.020366],
        "precision": "estimated",
    },
    {
        "keywords": ["上海 运光路", "运光路小公园"],
        "coordinates": [121.5128, 31.3031],
        "precision": "estimated",
    },
    {
        "keywords": ["闵行区 剑川路940", "大零号湾"],
        "coordinates": [121.432245, 31.030331],
        "precision": "estimated",
    },
    {
        "keywords": ["奉贤", "南行港路2903"],
        "coordinates": [121.474047, 30.917932],
        "precision": "estimated",
    },
]

MUNICIPALITIES = {"上海", "北京", "天津", "重庆"}
PROVINCES = {
    "江苏",
    "浙江",
    "广东",
    "四川",
    "河北",
    "陕西",
    "海南",
    "山西",
    "福建",
    "河南",
    "江西",
    "湖南",
    "辽宁",
}


@dataclass(frozen=True)
class ProgramFolder:
    client: str
    project: str
    path: Path
    asset_base: str = "programs"
    source_sheet: str = "项目"
    relative_folder: str | None = None

    @property
    def key(self) -> tuple[str, str]:
        return (self.client, self.project)

    @property
    def folder_path(self) -> str:
        if self.relative_folder:
            return self.relative_folder
        if self.client:
            return f"{self.client}/{self.project}"
        return self.project


def read_shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for item in root.findall("a:si", NS):
        strings.append("".join(node.text or "" for node in item.iterfind(".//a:t", NS)))
    return strings


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("a:v", NS)

    if cell_type == "s" and value_node is not None and value_node.text is not None:
        return shared_strings[int(value_node.text)]

    if cell_type == "inlineStr":
        inline = cell.find("a:is", NS)
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iterfind(".//a:t", NS))

    if value_node is None or value_node.text is None:
        return ""

    return value_node.text


def load_sheet_rows(sheet_name: str) -> list[dict[str, str]]:
    with ZipFile(XLSX_PATH) as archive:
        shared_strings = read_shared_strings(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}

        relationship_id = next(
            sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            for sheet in workbook.find("a:sheets", NS)
            if sheet.attrib["name"] == sheet_name
        )
        sheet_path = "xl/" + rel_map[relationship_id]
        worksheet = ET.fromstring(archive.read(sheet_path))

        rows: list[dict[str, str]] = []
        for row in worksheet.findall(".//a:sheetData/a:row", NS)[1:]:
            row_values: dict[str, str] = {"_rownum": row.attrib.get("r", "")}
            for cell in row.findall("a:c", NS):
                ref = cell.attrib.get("r", "")
                column = "".join(ch for ch in ref if ch.isalpha())
                row_values[column] = cell_value(cell, shared_strings).strip()

            if any(value for key, value in row_values.items() if key != "_rownum"):
                rows.append(row_values)

        return rows


def load_amap_geocode_cache() -> dict[str, dict[str, object]]:
    if not AMAP_GEOCODE_CACHE_PATH.exists():
        return {}

    try:
        payload = json.loads(AMAP_GEOCODE_CACHE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    return payload if isinstance(payload, dict) else {}


def normalize(value: str) -> str:
    value = (value or "").strip().lower()
    value = (
        value.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("，", ",")
        .replace("：", ":")
        .replace("（", "(")
        .replace("）", ")")
        .replace("&", " and ")
        .replace("+", " plus ")
        .replace("·", " ")
        .replace("xi’an", "xi'an")
        .replace("xi an", "xi'an")
    )
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", value)
    return value


def natural_key(value: str) -> list[object]:
    return [int(chunk) if chunk.isdigit() else chunk.lower() for chunk in re.split(r"(\d+)", value)]


def excel_serial_to_year(serial_text: str) -> int:
    if not serial_text:
        return 0

    matched_year = re.search(r"(19|20)\d{2}", serial_text)
    if matched_year:
        return int(matched_year.group(0))

    try:
        serial = int(float(serial_text))
    except (TypeError, ValueError):
        return 0

    base = datetime(1899, 12, 30)
    return (base + timedelta(days=serial)).year


def folder_contains_images(path: Path) -> bool:
    return any(item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS for item in path.iterdir())


def list_program_folders() -> list[ProgramFolder]:
    folders: list[ProgramFolder] = []
    for client_dir in sorted(PROGRAMS_DIR.iterdir(), key=lambda path: natural_key(path.name)):
        if not client_dir.is_dir():
            continue
        for project_dir in sorted(client_dir.iterdir(), key=lambda path: natural_key(path.name)):
            if project_dir.is_dir() and folder_contains_images(project_dir):
                folders.append(
                    ProgramFolder(
                        client=client_dir.name,
                        project=project_dir.name,
                        path=project_dir,
                        asset_base="programs",
                        source_sheet="项目",
                    )
                )
    return folders


def list_field_trip_folders() -> list[ProgramFolder]:
    folders: list[ProgramFolder] = []
    for project_dir in sorted(FIELD_TRIP_DIR.iterdir(), key=lambda path: natural_key(path.name)):
        if project_dir.is_dir() and folder_contains_images(project_dir):
            folders.append(
                ProgramFolder(
                    client="",
                    project=project_dir.name,
                    path=project_dir,
                    asset_base="FieldTrip",
                    source_sheet="习作",
                    relative_folder=project_dir.name,
                )
            )
    return folders


def build_rows_by_client(rows: Iterable[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    rows_by_client: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        for alias in {row.get("D", ""), row.get("E", "")}:
            if alias:
                rows_by_client.setdefault(alias, []).append(row)
    return rows_by_client


def row_name_matches(project_name: str, row: dict[str, str], title_columns: tuple[str, str] = ("F", "G")) -> bool:
    target = normalize(project_name)
    titles = {normalize(row.get(title_columns[0], "")), normalize(row.get(title_columns[1], ""))}

    if target in titles:
        return True

    return any(target and title and (target in title or title in target) for title in titles)


def match_folder_to_row(
    folder: ProgramFolder,
    rows: list[dict[str, str]],
    rows_by_client: dict[str, list[dict[str, str]]],
) -> dict[str, str]:
    aliases = CLIENT_ALIASES.get(folder.client, [folder.client])
    candidates: list[dict[str, str]] = []
    seen_rownums: set[str] = set()

    for alias in aliases:
        for row in rows_by_client.get(alias, []):
            rownum = row["_rownum"]
            if rownum in seen_rownums:
                continue
            seen_rownums.add(rownum)
            candidates.append(row)

    override_title = PROJECT_MATCH_OVERRIDES.get(folder.key)
    if override_title:
        for row in candidates or rows:
            if row.get("F") == override_title or row.get("G") == override_title:
                return row

    exact_matches = [row for row in candidates if row_name_matches(folder.project, row)]
    if len(exact_matches) == 1:
        return exact_matches[0]

    if len(candidates) == 1:
        return candidates[0]

    raise RuntimeError(f"Unable to match folder {folder.client}/{folder.project} to a spreadsheet row")


def match_field_trip_folder_to_row(folder: ProgramFolder, rows: list[dict[str, str]]) -> dict[str, str]:
    override_title = FIELD_TRIP_MATCH_OVERRIDES.get(folder.project)
    if override_title:
        for row in rows:
            if row.get("C") == override_title or row.get("D") == override_title:
                return row

    exact_matches = [row for row in rows if row_name_matches(folder.project, row, ("C", "D"))]
    if len(exact_matches) == 1:
        return exact_matches[0]

    if len(exact_matches) > 1:
        raise RuntimeError(f"Multiple field trip rows matched {folder.project}")

    raise RuntimeError(f"Unable to match field trip folder {folder.project} to a spreadsheet row")


def parse_categories(row: dict[str, str], source_sheet: str) -> list[str]:
    if source_sheet == "习作":
        return ["field-trip"]

    token_map = {
        "architecture": "architecture",
        "建筑": "architecture",
        "smallscale": "small-scale",
        "小体量": "small-scale",
        "interior": "interior",
        "室内": "interior",
        "commercial": "commercial",
        "commecial": "commercial",
        "商业": "commercial",
        "workspace": "workspace",
        "办公": "workspace",
        "residential": "residential",
        "住宅": "residential",
        "hospitality": "hospitality",
        "酒店": "hospitality",
        "educational": "educational",
        "education": "educational",
        "教育": "educational",
        "civic": "civic",
        "公共": "civic",
        "campus": "campus",
        "园区": "campus",
        "landscape": "landscape",
        "景观": "landscape",
    }

    categories: list[str] = []
    seen: set[str] = set()

    raw_values = [row.get("I", ""), row.get("J", "")]
    for raw_value in raw_values:
        for token in re.split(r"[,，/]+", raw_value):
            normalized = normalize(token)
            if not normalized:
                continue
            category = token_map.get(normalized)
            if category and category not in seen:
                seen.add(category)
                categories.append(category)

    return categories


def guess_location_label(raw_location: str) -> str:
    if raw_location in LOCATION_OVERRIDES:
        return LOCATION_OVERRIDES[raw_location]

    parts = [part for part in raw_location.replace("，", " ").replace(",", " ").split() if part]
    if not parts:
        return "上海"

    if parts[0] in MUNICIPALITIES:
        return parts[0]

    if parts[0] in PROVINCES and len(parts) > 1:
        second = parts[1]
        if second in LOCATION_OVERRIDES:
            return LOCATION_OVERRIDES[second]
        if second.endswith("市"):
            return second[:-1]
        if second.endswith("万象城"):
            return second[:-3]
        return second

    first = parts[0]
    if first.endswith("市"):
        return first[:-1]

    return first


def resolve_location_info(raw_location: str) -> tuple[str, str, list[float]]:
    location = guess_location_label(raw_location)
    metadata = LOCATION_METADATA.get(location)
    if metadata is None:
        metadata = LOCATION_METADATA["上海"]
    return location, metadata["locationEn"], metadata["coordinates"]


def keyword_coordinate_override(*texts: str) -> tuple[list[float], str] | None:
    haystack = " | ".join(text for text in texts if text)
    for item in ADDRESS_KEYWORD_COORDINATES:
        if any(keyword in haystack for keyword in item["keywords"]):
            return item["coordinates"], item["precision"]
    return None


def geocode_address(raw_address: str, fallback_coordinates: list[float]) -> tuple[list[float], str]:
    if not raw_address:
        return fallback_coordinates, "approximate"

    is_china_query = bool(re.search(r"[\u4e00-\u9fff]", raw_address))

    queries = [
        raw_address,
    ]
    if is_china_query:
        queries = [
            "中国" + raw_address.replace(" ", ""),
            raw_address.replace(" ", ""),
            raw_address,
        ]
    seen_queries: set[str] = set()
    best_coordinates: list[float] | None = None

    if not MAPBOX_ACCESS_TOKEN:
        return fallback_coordinates, "estimated"

    for query in queries:
        if not query or query in seen_queries:
            continue
        seen_queries.add(query)

        url = (
            "https://api.mapbox.com/search/geocode/v6/forward?q="
            + urllib.parse.quote(query)
            + f"&access_token={MAPBOX_ACCESS_TOKEN}&limit=1&language=zh,en"
        )
        if is_china_query:
            url += "&country=cn"

        try:
            output = subprocess.check_output(["curl", "-s", url], text=True, timeout=15)
            payload = json.loads(output)
        except Exception:
            continue

        features = payload.get("features", [])
        if not features:
            continue

        feature = features[0]
        coordinates = feature.get("geometry", {}).get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            continue

        feature_type = feature.get("properties", {}).get("feature_type", "")
        best_coordinates = [float(coordinates[0]), float(coordinates[1])]
        if feature_type not in APPROXIMATE_FEATURE_TYPES:
            return best_coordinates, "detailed"

    if best_coordinates is not None:
        return best_coordinates, "approximate"

    return fallback_coordinates, "approximate"


def list_images(folder: ProgramFolder) -> tuple[str, list[str]]:
    image_names = sorted(
        [
            path.name
            for path in folder.path.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        ],
        key=natural_key,
    )

    if not image_names:
        raise RuntimeError(f"No images found in {folder.path}")

    explicit_cover = next((name for name in image_names if Path(name).stem.lower() == "cover"), None)
    if explicit_cover:
        cover = explicit_cover
        ordered_images = [name for name in image_names if name != explicit_cover]
    else:
        override_cover = IMAGE_COVER_OVERRIDES.get(folder.key)
        if override_cover in image_names:
            cover = override_cover
        else:
            cover = image_names[0]
        ordered_images = [cover] + [name for name in image_names if name != cover]
    return cover, ordered_images


def is_map_only(row: dict[str, str]) -> bool:
    return "仅地图" in row.get("K", "")


def is_video_only(row: dict[str, str]) -> bool:
    return "仅视频" in row.get("B", "") or "仅视频" in row.get("K", "")


def is_temporarily_hidden(folder: ProgramFolder) -> bool:
    return folder.key in TEMP_HIDDEN_PROJECT_KEYS


def build_project_entry(
    index: int,
    folder: ProgramFolder,
    row: dict[str, str],
    amap_geocode_cache: dict[str, dict[str, object]],
) -> dict[str, object]:
    cover, images = list_images(folder)
    is_field_trip = folder.source_sheet == "习作"
    raw_location = row.get("E", "") if is_field_trip else row.get("H", "")
    if is_field_trip:
        location, location_en, fallback_coordinates = FIELD_TRIP_LOCATION_TRANSLATIONS.get(
            raw_location,
            (raw_location, raw_location, [121.469102, 31.232344]),
        )
    else:
        location, location_en, fallback_coordinates = resolve_location_info(raw_location)
    cache_key = f"{folder.asset_base}/{folder.folder_path}"
    cached_geocode = amap_geocode_cache.get(cache_key)

    if cached_geocode and isinstance(cached_geocode.get("coordinates"), list) and len(cached_geocode["coordinates"]) == 2:
        coordinates = [float(cached_geocode["coordinates"][0]), float(cached_geocode["coordinates"][1])]
        coordinate_precision = str(cached_geocode.get("precision", "estimated"))
    else:
        keyword_override = None if is_field_trip else keyword_coordinate_override(row.get("H", ""), row.get("F", ""), row.get("G", ""))
        if keyword_override is not None:
            coordinates, coordinate_precision = keyword_override
        else:
            coordinates, coordinate_precision = geocode_address(raw_location, fallback_coordinates)
    display_override = {} if is_field_trip else PROJECT_DISPLAY_OVERRIDES.get(folder.key, {})

    title = display_override.get("title", row.get("C" if is_field_trip else "F", folder.project))
    title_en = display_override.get("titleEn", row.get("D" if is_field_trip else "G", folder.project))
    location = display_override.get("location", location)
    location_en = display_override.get("locationEn", location_en)
    coordinates = display_override.get("coordinates", coordinates)
    if "coordinates" in display_override:
        coordinate_precision = "detailed"

    if is_field_trip:
        designer, designer_en = FIELD_TRIP_CLIENT_OVERRIDES.get(title, ("(习作)", "(Field Trip)"))
    else:
        designer, designer_en = row.get("D", folder.client), row.get("E", folder.client)

    return {
        "id": index,
        "year": excel_serial_to_year(row.get("B" if is_field_trip else "C", "")),
        "title": title,
        "titleEn": title_en,
        "designer": designer,
        "designerEn": designer_en,
        "folder": folder.folder_path,
        "assetBase": folder.asset_base,
        "cover": cover,
        "address": raw_location,
        "location": location,
        "locationEn": location_en,
        "coordinates": coordinates,
        "coordinatePrecision": coordinate_precision,
        "mapOnly": False if is_field_trip else is_map_only(row),
        "categories": parse_categories(row, folder.source_sheet),
        "images": images,
    }


def to_js_literal(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def write_output(projects: list[dict[str, object]]) -> None:
    content = (
        "// Auto-generated by scripts/generate_projects_data.py\n"
        "// Source: img/programs/Proj. Library.xlsx + img/programs/<client>/<project>/ + img/FieldTrip/<project>/\n\n"
        "const projectsData = "
        f"{to_js_literal(projects)};\n"
    )
    OUTPUT_PATH.write_text(content, encoding="utf-8")


def main() -> None:
    project_rows = load_sheet_rows("项目")
    field_trip_rows = load_sheet_rows("习作")
    rows_by_client = build_rows_by_client(project_rows)
    folders = list_program_folders()
    field_trip_folders = list_field_trip_folders()
    amap_geocode_cache = load_amap_geocode_cache()

    projects: list[dict[str, object]] = []
    next_id = 0
    for folder in folders:
        if is_temporarily_hidden(folder):
            continue
        row = match_folder_to_row(folder, project_rows, rows_by_client)
        if is_video_only(row) or is_map_only(row):
            continue
        projects.append(build_project_entry(next_id, folder, row, amap_geocode_cache))
        next_id += 1

    for folder in field_trip_folders:
        row = match_field_trip_folder_to_row(folder, field_trip_rows)
        projects.append(build_project_entry(next_id, folder, row, amap_geocode_cache))
        next_id += 1

    write_output(projects)
    print(f"Wrote {len(projects)} projects to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
