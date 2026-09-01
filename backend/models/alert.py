"""
AquaGNN - Alert ORM Model
Represents an active emergency condition at a drainage node.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from ..database.db import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    node_id = Column(String, ForeignKey("nodes.id"), nullable=False, index=True)
    alert_type = Column(String, nullable=False)       # e.g. "flood_depth", "surcharge", "pump_failure"
    severity = Column(String, nullable=False)          # "warning", "critical", "danger"
    message = Column(String, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    node = relationship("Node", back_populates="alerts")

    def __repr__(self):
        return f"<Alert(id={self.id}, node={self.node_id!r}, severity={self.severity!r})>"
