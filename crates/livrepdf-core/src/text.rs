/// Decodifica uma "text string" PDF: UTF-16BE com BOM, UTF-8 com BOM,
/// ou PDFDocEncoding (aproximada por Latin-1).
pub fn decode_pdf_text(bytes: &[u8]) -> String {
    if let [0xFE, 0xFF, rest @ ..] = bytes {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&units);
    }
    if let [0xEF, 0xBB, 0xBF, rest @ ..] = bytes {
        return String::from_utf8_lossy(rest).into_owned();
    }
    bytes.iter().map(|&b| b as char).collect()
}

#[cfg(test)]
mod tests {
    use super::decode_pdf_text;

    #[test]
    fn decodes_utf16be_with_bom() {
        let bytes = [0xFE, 0xFF, 0x00, b'O', 0x00, b'l', 0x00, 0xE1];
        assert_eq!(decode_pdf_text(&bytes), "Olá");
    }

    #[test]
    fn decodes_utf8_with_bom() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("ação".as_bytes());
        assert_eq!(decode_pdf_text(&bytes), "ação");
    }

    #[test]
    fn decodes_latin1_fallback() {
        assert_eq!(decode_pdf_text(&[b'C', 0xE9, b'u']), "Céu");
    }
}
