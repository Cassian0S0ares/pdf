use assert_cmd::Command;
use livrepdf_core::testing::make_pdf_with_title;

#[test]
fn info_prints_document_json() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("doc.pdf");
    std::fs::write(&path, make_pdf_with_title(&["a", "b"], "Teste")).unwrap();

    let out = Command::cargo_bin("livrepdf-cli").unwrap().arg("info").arg(&path).assert().success();
    let json: serde_json::Value = serde_json::from_slice(&out.get_output().stdout).unwrap();
    assert_eq!(json["pageCount"], 2);
    assert_eq!(json["title"], "Teste");
    assert_eq!(json["fileName"], "doc.pdf");
}

#[test]
fn info_reports_error_json_and_exit_1() {
    let out = Command::cargo_bin("livrepdf-cli").unwrap().args(["info", "nao-existe.pdf"]).assert().code(1);
    let json: serde_json::Value = serde_json::from_slice(&out.get_output().stderr).unwrap();
    assert_eq!(json["code"], "IO");
}
