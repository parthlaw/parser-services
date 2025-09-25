from enum import Enum

class UserFacingError(Exception):
    """Custom exception class for user-facing error messages."""
    def __init__(self, message: str):
        self.user_message = message
        super().__init__(message)

class ErrorMessages(Enum):
    """Standardized user-facing error messages."""
    PDF_UNREADABLE = "Not able to read the pdf"
    PDF_LOCKED = "Pdf is locked, upload unlocked pdf"
    PDF_CORRUPTED = "Pdf unreadable"
    PDF_IMAGE_BASED = "Pdf is image based, we don't support image based pdfs"
    HEADERS_NOT_FOUND = "Unable to find headers"
    UNKNOWN_ERROR = "Unknown error occurred while processing your document"
