package com.diegoalegil.animeshowdown.service;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.diegoalegil.animeshowdown.dto.TierListDto;
import com.diegoalegil.animeshowdown.dto.TierListItemRequest;
import com.diegoalegil.animeshowdown.dto.TierListSaveRequest;
import com.diegoalegil.animeshowdown.model.Personaje;
import com.diegoalegil.animeshowdown.model.SlugUtil;
import com.diegoalegil.animeshowdown.model.TierList;
import com.diegoalegil.animeshowdown.model.TierListItem;
import com.diegoalegil.animeshowdown.model.TierListTier;
import com.diegoalegil.animeshowdown.model.Usuario;
import com.diegoalegil.animeshowdown.repository.PersonajeRepository;
import com.diegoalegil.animeshowdown.repository.TierListRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
public class TierListService {

    private static final int MAX_ITEMS = 120;
    private static final String TITULO_DEFAULT = "Mi tier list anime";

    private final TierListRepository tierListRepository;
    private final PersonajeRepository personajeRepository;

    public TierListService(TierListRepository tierListRepository, PersonajeRepository personajeRepository) {
        this.tierListRepository = tierListRepository;
        this.personajeRepository = personajeRepository;
    }

    @Transactional(readOnly = true)
    public List<TierListDto> listarMias(Usuario usuario) {
        Usuario requerido = exigirUsuario(usuario);
        return tierListRepository.findByUsuarioIdOrderByUpdatedAtDesc(requerido.getId())
                .stream()
                .map(TierListDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TierListDto mia(Usuario usuario, Long id) {
        return TierListDto.from(buscarPropia(usuario, id));
    }

    @Transactional(readOnly = true)
    public TierListDto publica(String slug) {
        return TierListDto.from(tierListRepository.findBySlugAndPublicoTrue(slug)
                .orElseThrow(() -> new EntityNotFoundException("Tier list no encontrada")));
    }

    @Transactional
    public TierListDto crear(Usuario usuario, TierListSaveRequest request) {
        Usuario requerido = exigirUsuario(usuario);
        TierList tierList = new TierList();
        tierList.setUsuario(requerido);
        aplicarCampos(tierList, request, true);
        reemplazarItems(tierList, request != null ? request.items() : null);
        return TierListDto.from(tierListRepository.save(tierList));
    }

    @Transactional
    public TierListDto actualizar(Usuario usuario, Long id, TierListSaveRequest request) {
        TierList tierList = buscarPropia(usuario, id);
        aplicarCampos(tierList, request, false);
        reemplazarItems(tierList, request != null ? request.items() : null);
        return TierListDto.from(tierListRepository.save(tierList));
    }

    @Transactional
    public void eliminar(Usuario usuario, Long id) {
        TierList tierList = buscarPropia(usuario, id);
        tierListRepository.delete(tierList);
    }

    private TierList buscarPropia(Usuario usuario, Long id) {
        Usuario requerido = exigirUsuario(usuario);
        return tierListRepository.findOwnWithItems(id, requerido.getId())
                .orElseThrow(() -> new EntityNotFoundException("Tier list no encontrada"));
    }

    private Usuario exigirUsuario(Usuario usuario) {
        if (usuario == null || usuario.getId() == null) {
            throw new IllegalArgumentException("Se requiere usuario autenticado");
        }
        return usuario;
    }

    private void aplicarCampos(TierList tierList, TierListSaveRequest request, boolean creando) {
        String titulo = request != null ? request.titulo() : null;
        titulo = titulo == null ? "" : titulo.trim();
        if (titulo.isBlank()) {
            titulo = TITULO_DEFAULT;
        }
        if (titulo.length() > 120) {
            throw new IllegalArgumentException("El título no puede superar 120 caracteres");
        }
        tierList.setTitulo(titulo);
        tierList.setAnimeSlug(normalizarAnimeSlug(request != null ? request.animeSlug() : null));
        tierList.setPublico(request != null && Boolean.TRUE.equals(request.publico()));
        if (creando && tierList.getSlug() == null) {
            tierList.setSlug(generarSlugUnico(titulo));
        }
    }

    private String normalizarAnimeSlug(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.length() > 120) {
            throw new IllegalArgumentException("El slug de anime no puede superar 120 caracteres");
        }
        return value;
    }

    private String generarSlugUnico(String titulo) {
        String base = SlugUtil.slugify(titulo);
        String candidato = base;
        int i = 2;
        while (tierListRepository.existsBySlug(candidato)) {
            candidato = base + "-" + i;
            i++;
        }
        return candidato;
    }

    private void reemplazarItems(TierList tierList, List<TierListItemRequest> rawItems) {
        List<TierListItemRequest> items = rawItems == null ? List.of() : rawItems;
        if (items.size() > MAX_ITEMS) {
            throw new IllegalArgumentException("Una tier list no puede tener más de " + MAX_ITEMS + " personajes");
        }

        List<Long> ids = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        for (TierListItemRequest item : items) {
            if (item == null || item.personajeId() == null) {
                throw new IllegalArgumentException("Cada item debe incluir personajeId");
            }
            if (!vistos.add(item.personajeId())) {
                throw new IllegalArgumentException("La tier list contiene personajes duplicados");
            }
            ids.add(item.personajeId());
        }

        Map<Long, Personaje> personajes = new HashMap<>();
        personajeRepository.findAllById(ids).forEach(p -> personajes.put(p.getId(), p));

        tierList.getItems().clear();
        Map<TierListTier, Integer> posiciones = new EnumMap<>(TierListTier.class);
        for (TierListItemRequest item : items) {
            Personaje personaje = personajes.get(item.personajeId());
            if (personaje == null) {
                throw new EntityNotFoundException("Personaje no encontrado: id=" + item.personajeId());
            }
            TierListTier tier = parseTier(item.tier());
            int posicion = posiciones.merge(tier, 1, Integer::sum) - 1;
            tierList.getItems().add(new TierListItem(tierList, personaje, tier, posicion));
        }
    }

    private TierListTier parseTier(String raw) {
        if (raw == null || raw.isBlank()) {
            return TierListTier.BANCA;
        }
        try {
            return TierListTier.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Tier inválido: " + raw);
        }
    }
}
