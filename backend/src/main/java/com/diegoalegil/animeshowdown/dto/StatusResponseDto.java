package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.List;

public record StatusResponseDto(
        String currentStatus,
        LocalDateTime checkedAt,
        StatusWindowDto last24h,
        StatusWindowDto last7d,
        StatusWindowDto last30d,
        StatusWindowDto last90d,
        List<StatusSampleDto> samples) {
}
