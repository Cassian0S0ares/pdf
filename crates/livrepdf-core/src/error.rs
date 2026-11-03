use serde::Serialize;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Io,
    NotAPdf,
    DocumentNotFound,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{message}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), details: None }
    }

    pub fn with_details(mut self, details: impl Into<String>) -> Self {
        self.details = Some(details.into());
        self
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::new(ErrorCode::Io, "Não foi possível acessar o arquivo").with_details(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_camel_case_with_screaming_code() {
        let err = AppError::new(ErrorCode::NotAPdf, "x").with_details("d");
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json, serde_json::json!({"code": "NOT_A_PDF", "message": "x", "details": "d"}));
    }

    #[test]
    fn io_error_maps_to_io_code() {
        let err: AppError = std::io::Error::new(std::io::ErrorKind::NotFound, "nope").into();
        assert_eq!(err.code, ErrorCode::Io);
        assert_eq!(err.details.as_deref(), Some("nope"));
    }
}
