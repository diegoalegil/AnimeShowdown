package com.diegoalegil.animeshowdown.dto;

import java.time.LocalDateTime;

import com.diegoalegil.animeshowdown.model.EstadoTorneo;

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

    public TorneoResumenDto() {
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
}
