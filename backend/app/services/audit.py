from typing import Optional, Any
from datetime import date, datetime
from sqlalchemy.orm import Session
from app import models
from app.models.audit import AuditAction


def _sanitize_for_json(obj):
    """Recursively convert date/datetime objects to ISO strings for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    return obj


class AuditLogger:
    @staticmethod
    def log(
        db: Session,
        user_id: Optional[int],
        action: AuditAction,
        table_name: Optional[str] = None,
        record_id: Optional[int] = None,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> models.AuditLog:
        log = models.AuditLog(
            user_id=user_id,
            action=action.value if isinstance(action, AuditAction) else action,
            table_name=table_name,
            record_id=record_id,
            old_values=_sanitize_for_json(old_values) if old_values else None,
            new_values=_sanitize_for_json(new_values) if new_values else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(log)
        db.flush()
        return log

    @staticmethod
    def log_create(db: Session, user_id: int, table: str, rec_id: int, new_vals: dict, **kw):
        AuditLogger.log(db, user_id, AuditAction.CREATE, table, rec_id, new_values=new_vals, **kw)

    @staticmethod
    def log_update(db: Session, user_id: int, table: str, rec_id: int, old_vals: dict, new_vals: dict, **kw):
        AuditLogger.log(db, user_id, AuditAction.UPDATE, table, rec_id, old_values=old_vals, new_values=new_vals, **kw)

    @staticmethod
    def log_delete(db: Session, user_id: int, table: str, rec_id: int, old_vals: dict, **kw):
        AuditLogger.log(db, user_id, AuditAction.DELETE, table, rec_id, old_values=old_vals, **kw)


class NotificationService:
    @staticmethod
    def create(
        db: Session,
        user_id: int,
        type_enum,
        title: str,
        message: Optional[str] = None,
        reference_id: Optional[int] = None,
        reference_type: Optional[str] = None,
    ) -> models.Notification:
        notif = models.Notification(
            user_id=user_id,
            type=type_enum.value if hasattr(type_enum, "value") else type_enum,
            title=title,
            message=message,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        db.add(notif)
        db.flush()
        return notif

    @staticmethod
    def mark_read(db: Session, user_id: int, notification_id: int):
        notif = db.query(models.Notification).filter(
            models.Notification.notification_id == notification_id,
            models.Notification.user_id == user_id,
        ).first()
        if notif and not notif.is_read:
            notif.is_read = True
            from datetime import datetime, timezone
            notif.read_at = datetime.now(timezone.utc)
            db.flush()
        return notif

    @staticmethod
    def mark_all_read(db: Session, user_id: int):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        db.query(models.Notification).filter(
            models.Notification.user_id == user_id,
            models.Notification.is_read == False,
        ).update({"is_read": True, "read_at": now}, synchronize_session=False)
        db.flush()

    @staticmethod
    def count(db: Session, user_id: int) -> tuple[int, int]:
        total = db.query(models.Notification).filter(models.Notification.user_id == user_id).count()
        unread = db.query(models.Notification).filter(
            models.Notification.user_id == user_id,
            models.Notification.is_read == False,
        ).count()
        return total, unread
