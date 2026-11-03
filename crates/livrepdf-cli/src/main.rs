use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use livrepdf_core::DocumentSession;

#[derive(Parser)]
#[command(name = "livrepdf-cli", version, about = "Ferramentas de linha de comando do LivrePDF")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Mostra metadados do PDF em JSON
    Info { file: PathBuf },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Info { file } => match DocumentSession::open(&file) {
            Ok(session) => {
                println!("{}", serde_json::to_string_pretty(&session.info("cli")).unwrap());
                ExitCode::SUCCESS
            }
            Err(err) => {
                eprintln!("{}", serde_json::to_string(&err).unwrap());
                ExitCode::FAILURE
            }
        },
    }
}
