"""Generated makeup look ORM model."""

from sqlalchemy import Column, Integer, String, JSON, Text, Timestamp
from sqlalchemy.orm import relationship

from app.database import Base


class MakeupLook(Base):
    __tablename__ = "makeup_looks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), nullable=False, index=True)
    look_name = Column(String(200))
    look_style = Column(String(50), comment="natural/glam/evening/professional")
    description = Column(Text)
    step_instructions = Column(JSON, nullable=False, comment="Array of step objects")
    shade_ids = Column(JSON, nullable=False, comment="Array of shade IDs used")
    region_colors = Column(JSON, nullable=False, comment="Map of face region to hex color")
    skin_tone_lab = Column(JSON, nullable=False)

    user = relationship("UserPreference", back_populates="makeup_looks")
