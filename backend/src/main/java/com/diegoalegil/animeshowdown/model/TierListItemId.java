package com.diegoalegil.animeshowdown.model;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class TierListItemId implements Serializable {

    @Column(name = "tier_list_id")
    private Long tierListId;

    @Column(name = "personaje_id")
    private Long personajeId;

    public TierListItemId() {
    }

    public TierListItemId(Long tierListId, Long personajeId) {
        this.tierListId = tierListId;
        this.personajeId = personajeId;
    }

    public Long getTierListId() {
        return tierListId;
    }

    public void setTierListId(Long tierListId) {
        this.tierListId = tierListId;
    }

    public Long getPersonajeId() {
        return personajeId;
    }

    public void setPersonajeId(Long personajeId) {
        this.personajeId = personajeId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TierListItemId that)) return false;
        return Objects.equals(tierListId, that.tierListId)
                && Objects.equals(personajeId, that.personajeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tierListId, personajeId);
    }
}
