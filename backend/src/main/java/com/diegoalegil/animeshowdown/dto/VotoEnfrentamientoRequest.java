package com.diegoalegil.animeshowdown.dto;

public class VotoEnfrentamientoRequest {

    private Long personajeGanadorId;
    private boolean empate;

    // Intención de voto (feature #15): el "por qué" OPCIONAL. Deliberadamente
    // SIN @NotNull ni validación de enum — una categoría blank/desconocida
    // degrada a "voto sin intención" (CategoriaVoto.fromId → null), nunca
    // rechaza el voto. El cliente la manda como id de wire ('poder',
    // 'mejor-villano'…). En la práctica casi siempre llega null en el POST: la
    // intención se fija después en un segundo tap vía PATCH set-once.
    private String categoria;

    public VotoEnfrentamientoRequest() {
    }

    public Long getPersonajeGanadorId() {
        return personajeGanadorId;
    }

    public void setPersonajeGanadorId(Long personajeGanadorId) {
        this.personajeGanadorId = personajeGanadorId;
    }

    public boolean isEmpate() {
        return empate;
    }

    public void setEmpate(boolean empate) {
        this.empate = empate;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }
}
