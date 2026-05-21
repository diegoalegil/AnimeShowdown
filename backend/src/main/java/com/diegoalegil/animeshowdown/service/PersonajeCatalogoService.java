package com.diegoalegil.animeshowdown.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.diegoalegil.animeshowdown.dto.PersonajeCatalogoDto;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;

@Service
public class PersonajeCatalogoService {

    private static final List<String> DEFAULT_FIELDS = List.of("slug", "nombre", "anime", "imagenUrl");
    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "id", "slug", "nombre", "anime", "descripcion", "imagenUrl");

    private final PersonajeRepository personajeRepository;

    public PersonajeCatalogoService(PersonajeRepository personajeRepository) {
        this.personajeRepository = personajeRepository;
    }

    public String normalizarFields(String fields) {
        if (fields == null || fields.isBlank()) {
            return String.join(",", DEFAULT_FIELDS);
        }
        LinkedHashSet<String> sane = new LinkedHashSet<>();
        Arrays.stream(fields.split(","))
                .map(String::trim)
                .filter(ALLOWED_FIELDS::contains)
                .forEach(sane::add);
        if (sane.isEmpty()) {
            sane.addAll(DEFAULT_FIELDS);
        }
        return String.join(",", sane);
    }

    @Cacheable(value = "personajes-catalogo", key = "#fieldsKey")
    public CatalogoPayload catalogo(String fieldsKey) {
        Set<String> fields = new LinkedHashSet<>(Arrays.asList(fieldsKey.split(",")));
        List<Map<String, Object>> items = personajeRepository.findAllOrderBySlug().stream()
                .map(PersonajeCatalogoDto::from)
                .map(dto -> dto.toFieldMap(fields))
                .toList();
        return new CatalogoPayload(items, etag(fieldsKey, items));
    }

    private String etag(String fieldsKey, List<Map<String, Object>> items) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(fieldsKey.getBytes(StandardCharsets.UTF_8));
            for (Map<String, Object> item : items) {
                for (Map.Entry<String, Object> entry : item.entrySet()) {
                    digest.update((byte) '|');
                    digest.update(entry.getKey().getBytes(StandardCharsets.UTF_8));
                    digest.update((byte) '=');
                    Object value = entry.getValue();
                    if (value != null) {
                        digest.update(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
                    }
                }
            }
            return "\"" + toHex(digest.digest()).substring(0, 24) + "\"";
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 no disponible para ETag", ex);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xf, 16));
            sb.append(Character.forDigit(b & 0xf, 16));
        }
        return sb.toString();
    }

    public record CatalogoPayload(List<Map<String, Object>> items, String etag) {
    }
}
