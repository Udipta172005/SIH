"""
AquaGNN - Node ORM Model
Represents a drainage-network node (intersection, manhole, underpass, basin, pump station, outfall).
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.orm import relationship
from ..database.db import Base


class Node(Base):
    __tablename__ = "nodes"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_m = Column(Float, nullable=False, default=0.0)
    node_type = Column(String, nullable=False, default="intersection")
    critical_tag = Column(String, nullable=True)
    catchment_area_m2 = Column(Float, nullable=False, default=0.0)
    runoff_coeff = Column(Float, nullable=False, default=0.8)
    surface_ponding_area_m2 = Column(Float, nullable=False, default=0.0)
    max_capacity_m3 = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    outgoing_edges = relationship("Edge", foreign_keys="Edge.source_node_id", back_populates="source_node")
    incoming_edges = relationship("Edge", foreign_keys="Edge.target_node_id", back_populates="target_node")
    alerts = relationship("Alert", back_populates="node")

    def __repr__(self):
        return f"<Node(id={self.id!r}, name={self.name!r})>"
