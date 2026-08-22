from dotenv import load_dotenv  # noqa
load_dotenv()

from app.main import app  # noqa
__all__ = ["app"]
