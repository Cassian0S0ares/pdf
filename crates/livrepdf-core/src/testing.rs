//! Geradores de PDF para testes (usados também por livrepdf-cli).
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

pub fn make_pdf(pages: &[&str]) -> Vec<u8> {
    save(build(pages, None))
}

pub fn make_pdf_with_title(pages: &[&str], title: &str) -> Vec<u8> {
    save(build(pages, Some(title)))
}

/// PDF com entrada /Encrypt no trailer (sem criptografia real) —
/// suficiente para a detecção de documento protegido.
pub fn make_encrypted_stub_pdf() -> Vec<u8> {
    let mut doc = build(&["secreto"], None);
    let encrypt_id = doc.add_object(dictionary! {
        "Filter" => "Standard",
        "V" => 4,
        "R" => 4,
        "Length" => 128,
        "P" => -4,
    });
    doc.trailer.set("Encrypt", encrypt_id);
    save(doc)
}

fn build(pages: &[&str], title: Option<&str>) -> Document {
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    });
    let kids: Vec<Object> = pages
        .iter()
        .map(|text| {
            let content = Content {
                operations: vec![
                    Operation::new("BT", vec![]),
                    Operation::new("Tf", vec!["F1".into(), 24.into()]),
                    Operation::new("Td", vec![72.into(), 720.into()]),
                    Operation::new("Tj", vec![Object::string_literal(*text)]),
                    Operation::new("ET", vec![]),
                ],
            };
            let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
            let page_id = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content_id,
            });
            page_id.into()
        })
        .collect();
    let count = kids.len() as i64;
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => count,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
        }),
    );
    let catalog_id = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", catalog_id);
    if let Some(title) = title {
        let info_id = doc.add_object(dictionary! { "Title" => Object::string_literal(utf16be_bom(title)) });
        doc.trailer.set("Info", info_id);
    }
    doc
}

fn save(mut doc: Document) -> Vec<u8> {
    let mut buf = Vec::new();
    doc.save_to(&mut buf).expect("save test pdf");
    buf
}

/// PDF text strings com não-ASCII devem ser escritas como UTF-16BE com BOM
/// (convenção padrão para strings de /Info); `decode_pdf_text` espera BOM.
fn utf16be_bom(s: &str) -> Vec<u8> {
    let mut bytes = vec![0xFE, 0xFF];
    for unit in s.encode_utf16() {
        bytes.extend_from_slice(&unit.to_be_bytes());
    }
    bytes
}
