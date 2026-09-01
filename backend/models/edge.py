"""
AquaGNN - Edge / Conduit ORM Model
Represents a connection (stormwater conduit or street link) between two drainage nodes.
"""

from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from ..database.db import Base


class Edge(Base):
    __tablename__ = "edges"

    id = Column(String, primary_key=True, index=True)
    source_node_id = Column(String, ForeignKey("nodes.id"), nullable=False, index=True)
    target_node_id = Column(String, ForeignKey("nodes.id"), nullable=False, index=True)
    street_name = Column(String, nullable=True)
    conduit_type = Column(String, nullable=False, default="culvert_pipe")
    length_m = Column(Float, nullable=False, default=0.0)
    diameter_or_width_m = Column(Float, nullable=False, default=1.0)
    roughness_coeff = Column(Float, nullable=False, default=0.013)

    # Relationships
    source_node = relationship("Node", foreign_keys=[source_node_id], back_populates="outgoing_edges")
    target_node = relationship("Node", foreign_keys=[target_node_id], back_populates="incoming_edges")

    def __repr__(self):
        return f"<Edge(id={self.id!r}, {self.source_node_id} -> {self.target_node_id})>"
