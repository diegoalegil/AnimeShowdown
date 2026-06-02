package com.diegoalegil.animeshowdown.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {

    @Bean
    public Clock clock(@Value("${app.product-zone:UTC}") String productZone) {
        return Clock.system(ZoneId.of(productZone));
    }
}
