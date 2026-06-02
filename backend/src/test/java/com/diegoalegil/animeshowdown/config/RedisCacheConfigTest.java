package com.diegoalegil.animeshowdown.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {
        "spring.cache.type=redis"
})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class RedisCacheConfigTest {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired private CacheManager cacheManager;
    @Autowired private StringRedisTemplate redisTemplate;

    @Test
    void usaRedisCacheManagerConPrefijoAsYTtlPorCache() {
        assertThat(cacheManager).isInstanceOf(RedisCacheManager.class);

        var cache = cacheManager.getCache("personajes-catalogo");
        assertThat(cache).isNotNull();
        cache.put("demo", "ok");

        String key = "as:personajes-catalogo::demo";
        assertThat(redisTemplate.hasKey(key)).isTrue();
        Long ttl = redisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
        assertThat(ttl).isNotNull();
        assertThat(ttl).isGreaterThan(3_000);

        assertThat(cacheManager.getCache("cartas-catalogo")).isNotNull();
        assertThat(cacheManager.getCache("cartas-votos-score")).isNotNull();
    }
}
