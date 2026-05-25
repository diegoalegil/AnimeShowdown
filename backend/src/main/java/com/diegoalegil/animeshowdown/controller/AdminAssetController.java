package com.diegoalegil.animeshowdown.controller;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/admin/assets")
public class AdminAssetController {

    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;

    public AdminAssetController(ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
    }

    @GetMapping("/coverage")
    public AssetCoverageResponse coverage() throws IOException {
        List<JsonNode> personajes = readSeedArray("classpath:personajes-seed.json");
        List<JsonNode> torneos = readSeedArray("classpath:torneos-seed.json");
        Path frontendRoot = resolveFrontendRoot();

        List<CoverageBucket> buckets = new ArrayList<>();
        buckets.add(countCharacterCards(personajes, frontendRoot));
        buckets.add(countCharacterDerivedSlot("character-portraits", personajes, frontendRoot, "portraits"));
        buckets.add(countCharacterDerivedSlot("character-banners", personajes, frontendRoot, "banners"));
        buckets.add(countAnimeBanners(personajes, frontendRoot));
        buckets.add(countTournamentBanners(torneos, frontendRoot));

        long totalSlots = buckets.stream().mapToLong(CoverageBucket::totalSlots).sum();
        long realAssets = buckets.stream().mapToLong(CoverageBucket::realAssets).sum();
        long fallbackSlots = totalSlots - realAssets;

        return new AssetCoverageResponse(
                Instant.now(),
                frontendRoot != null,
                totalSlots,
                realAssets,
                fallbackSlots,
                percent(realAssets, totalSlots),
                percent(fallbackSlots, totalSlots),
                buckets);
    }

    private List<JsonNode> readSeedArray(String location) throws IOException {
        Resource resource = resourceLoader.getResource(location);
        try (InputStream input = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(input);
            List<JsonNode> items = new ArrayList<>();
            root.forEach(items::add);
            return items;
        }
    }

    private CoverageBucket countCharacterCards(List<JsonNode> personajes, Path frontendRoot) {
        long realAssets = personajes.stream()
                .map(personaje -> assetPathFromPublicUrl(text(personaje, "imagenUrl"), frontendRoot))
                .filter(this::exists)
                .count();
        return bucket("character-cards", personajes.size(), realAssets);
    }

    private CoverageBucket countCharacterDerivedSlot(
            String category,
            List<JsonNode> personajes,
            Path frontendRoot,
            String directory) {
        long realAssets = personajes.stream()
                .map(personaje -> {
                    Path cardPath = assetPathFromPublicUrl(text(personaje, "imagenUrl"), frontendRoot);
                    if (cardPath == null) return null;
                    Path cardDir = cardPath.getParent();
                    if (cardDir == null) return null;
                    return cardDir.resolve(directory).resolve(text(personaje, "slug") + ".webp");
                })
                .filter(this::exists)
                .count();
        return bucket(category, personajes.size(), realAssets);
    }

    private CoverageBucket countAnimeBanners(List<JsonNode> personajes, Path frontendRoot) {
        Map<String, String> animes = new LinkedHashMap<>();
        for (JsonNode personaje : personajes) {
            String anime = text(personaje, "anime");
            if (!anime.isBlank()) animes.putIfAbsent(slugify(anime), anime);
        }
        long realAssets = animes.keySet().stream()
                .map(slug -> frontendRoot == null
                        ? null
                        : frontendRoot.resolve("public/assets/anime-banners").resolve(slug + ".webp"))
                .filter(this::exists)
                .count();
        return bucket("anime-banners", animes.size(), realAssets);
    }

    private CoverageBucket countTournamentBanners(List<JsonNode> torneos, Path frontendRoot) {
        long realAssets = torneos.stream()
                .map(torneo -> frontendRoot == null
                        ? null
                        : frontendRoot.resolve("public/assets/tournament-banners")
                                .resolve(text(torneo, "slug") + ".webp"))
                .filter(this::exists)
                .count();
        return bucket("tournament-banners", torneos.size(), realAssets);
    }

    private Path assetPathFromPublicUrl(String publicUrl, Path frontendRoot) {
        if (frontendRoot == null || publicUrl == null || publicUrl.isBlank()) return null;
        String clean = publicUrl.replace('\\', '/');
        if (clean.startsWith("/img/")) return frontendRoot.resolve(clean.substring(1));
        if (clean.startsWith("/assets/")) return frontendRoot.resolve("public").resolve(clean.substring(1));
        return null;
    }

    private Path resolveFrontendRoot() {
        Path cwd = Paths.get("").toAbsolutePath().normalize();
        List<Path> candidates = List.of(
                cwd.resolve("frontend"),
                cwd.resolve("../frontend").normalize());
        return candidates.stream()
                .filter(Files::isDirectory)
                .findFirst()
                .orElse(null);
    }

    private boolean exists(Path path) {
        return path != null && Files.isRegularFile(path);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private static String slugify(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replace("&", " and ")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return normalized;
    }

    private static CoverageBucket bucket(String category, long totalSlots, long realAssets) {
        long fallbackSlots = totalSlots - realAssets;
        return new CoverageBucket(
                category,
                totalSlots,
                realAssets,
                fallbackSlots,
                percent(realAssets, totalSlots),
                percent(fallbackSlots, totalSlots));
    }

    private static double percent(long value, long total) {
        if (total <= 0) return 0;
        return Math.round((value * 1000.0 / total)) / 10.0;
    }

    public record AssetCoverageResponse(
            Instant generatedAt,
            boolean filesystemAvailable,
            long totalSlots,
            long realAssets,
            long fallbackSlots,
            double realAssetPercent,
            double fallbackPercent,
            List<CoverageBucket> buckets) {
    }

    public record CoverageBucket(
            String category,
            long totalSlots,
            long realAssets,
            long fallbackSlots,
            double realAssetPercent,
            double fallbackPercent) {
    }
}
