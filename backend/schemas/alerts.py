"""
AquaGNN - Pydantic Schemas for Alert API responses
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class AlertSchema(BaseModel):
    id: int
    node_id: str
    alert_type: str
    severity: str
    message: str
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertsResponse(BaseModel):
    alerts: List[AlertSchema]
