package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.diegoalegil.animeshowdown.model.EstadoTorneo;
import com.diegoalegil.animeshowdown.model.Torneo;

/**
 * Cabecera de torneo para listados (`GET /api/torneos`). Sin enfrentamientos:
 * eso lo trae TorneoDetalleDto. Calculados aparte por TorneoQueryService:
 *
 *   - numParticipantes: 2 × matches de ronda 1, 0 si no hay bracket aún.
 *   - totalRondas: ronda máxima en los matches del torneo.
 *   - rondaActual: ronda en juego ahora (mín ronda con ambos personajes
 *     setteados pero sin ganador). Si el torneo está SCHEDULED es 1;
 *     si está FINISHED es totalRondas (informativo, no hay "siguiente").
 *   - ganadorSlug: solo poblado si FINISHED.
 */
public class TorneoResumenDto {

    private Long id;
    private String slug;
    private String nombre;
    private String descripcion;
    private EstadoTorneo estado;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaInicio;
    private LocalDateTime fechaFinalizacion;
    private Integer numParticipantes;
    private Integer totalRondas;
    private Integer rondaActual;
    private String ganadorSlug;
    private Boolean publico;
    private Long votosUltimos7Dias;

    /**
     * Primeros 5 participantes (de ronda 1) para que el TorneoCard del
     * listado pueda mostrar el circulito de avatares sin tener que pedir
     * el detalle de cada torneo. Si la ronda 1 tiene menos de 5 matches,
     * el array trae lo que haya.
     */
    private List<PersonajeMiniDto> avataresPrincipales;

    public TorneoResumenDto() {
    }

    /**
     * Proyección escalar de la entidad para respuestas de mutación admin
     * (crear/iniciar/finalizar). Solo copia columnas planas ya cargadas — NO
     * accede a relaciones lazy (creadoPor/ganadorPersonaje) ni recalcula los
     * agregados de bracket (numParticipantes/rondas/votos), que quedan null.
     * El cliente que necesite el bracket completo pide GET /api/torneos/{id}.
     * Sirve para no exponer la entidad cruda (y su email de creador) en la
     * respuesta de las mutaciones.
     */
    public static TorneoResumenDto fromEntity(Torneo t) {
        TorneoResumenDto dto = new TorneoResumenDto();
        dto.setId(t.getId());
        dto.setSlug(t.getSlug());
        dto.setNombre(t.getNombre());
        dto.setDescripcion(t.getDescripcion());
        dto.setEstado(t.getEstado());
        dto.setFechaCreacion(t.getFechaCreacion());
        dto.setFechaInicio(t.getFechaInicio());
        dto.setFechaFinalizacion(t.getFechaFinalizacion());
        dto.setPublico(t.isPublico());
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public EstadoTorneo getEstado() {
        return estado;
    }

    public void setEstado(EstadoTorneo estado) {
        this.estado = estado;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public LocalDateTime getFechaInicio() {
        return fechaInicio;
    }

    public void setFechaInicio(LocalDateTime fechaInicio) {
        this.fechaInicio = fechaInicio;
    }

    public LocalDateTime getFechaFinalizacion() {
        return fechaFinalizacion;
    }

    public void setFechaFinalizacion(LocalDateTime fechaFinalizacion) {
        this.fechaFinalizacion = fechaFinalizacion;
    }

    public Integer getNumParticipantes() {
        return numParticipantes;
    }

    public void setNumParticipantes(Integer numParticipantes) {
        this.numParticipantes = numParticipantes;
    }

    public Integer getTotalRondas() {
        return totalRondas;
    }

    public void setTotalRondas(Integer totalRondas) {
        this.totalRondas = totalRondas;
    }

    public Integer getRondaActual() {
        return rondaActual;
    }

    public void setRondaActual(Integer rondaActual) {
        this.rondaActual = rondaActual;
    }

    public String getGanadorSlug() {
        return ganadorSlug;
    }

    public void setGanadorSlug(String ganadorSlug) {
        this.ganadorSlug = ganadorSlug;
    }

    public Boolean getPublico() {
        return publico;
    }

    public void setPublico(Boolean publico) {
        this.publico = publico;
    }

    public Long getVotosUltimos7Dias() {
        return votosUltimos7Dias;
    }

    public void setVotosUltimos7Dias(Long votosUltimos7Dias) {
        this.votosUltimos7Dias = votosUltimos7Dias;
    }

    public List<PersonajeMiniDto> getAvataresPrincipales() {
        return avataresPrincipales;
    }

    public void setAvataresPrincipales(List<PersonajeMiniDto> avataresPrincipales) {
        this.avataresPrincipales = avataresPrincipales;
    }
}
