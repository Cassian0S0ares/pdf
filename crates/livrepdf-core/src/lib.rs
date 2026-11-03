mod error;
mod session;
mod store;
mod text;

#[doc(hidden)]
pub mod testing;

pub use error::{AppError, ErrorCode, Result};
pub use session::{DocumentInfo, DocumentSession, ReadOnlyReason};
pub use store::SessionStore;
pub use text::decode_pdf_text;
