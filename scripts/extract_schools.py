#!/usr/bin/env python3

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def col_to_num(ref: str) -> int:
    match = re.match(r"([A-Z]+)", ref)
    if not match:
        return 1
    value = 0
    for ch in match.group(1):
        value = (value * 26) + ord(ch) - 64
    return value


def read_cell(shared_strings, cell):
    cell_type = cell.attrib.get("t")
    value = cell.find("a:v", NS)
    if cell_type == "s" and value is not None:
        return shared_strings[int(value.text)]
    if cell_type == "inlineStr":
        inline = cell.find("a:is", NS)
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iterfind(".//a:t", NS))
    if value is not None:
        return value.text or ""
    return ""


def normalize_value(key: str, raw: str):
    text = str(raw or "").strip()
    if not text:
        return ""
    if key in {"zipcode", "latitude", "longitude", "year_established"}:
        try:
            number = float(text)
            return int(number) if number.is_integer() else number
        except ValueError:
            return text
    return text


def extract_rows(xlsx_path: Path):
    with zipfile.ZipFile(xlsx_path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", NS):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iterfind(".//a:t", NS))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

        first_sheet = workbook.find("a:sheets", NS)[0]
        rel_id = first_sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        sheet_path = f"xl/{rel_map[rel_id]}"
        worksheet = ET.fromstring(archive.read(sheet_path))
        sheet_data = worksheet.find("a:sheetData", NS)

        headers = []
        records = []
        for index, row in enumerate(sheet_data.findall("a:row", NS), start=1):
            values = {}
            for cell in row.findall("a:c", NS):
                ref = cell.attrib.get("r", "A1")
                values[col_to_num(ref)] = read_cell(shared_strings, cell)

            if index == 1:
                width = max(values) if values else 0
                headers = [str(values.get(col, "")).strip() for col in range(1, width + 1)]
                continue

            record = {}
            for col, header in enumerate(headers, start=1):
                if not header:
                    continue
                record[header] = normalize_value(header, values.get(col, ""))

            if any(str(value).strip() for value in record.values()):
                records.append(record)

        return records


def main():
    if len(sys.argv) != 3:
        print("Usage: extract_schools.py <input.xlsx> <output.json>")
        raise SystemExit(1)

    input_path = Path(sys.argv[1]).expanduser().resolve()
    output_path = Path(sys.argv[2]).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows = extract_rows(input_path)
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
