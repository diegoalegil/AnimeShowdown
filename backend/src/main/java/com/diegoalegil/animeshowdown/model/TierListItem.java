package com.diegoalegil.animeshowdown.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tier_list_item")
@Getter
@Setter
public class TierListItem {

    @EmbeddedId
    private TierListItemId id = new TierListItemId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("tierListId")
    @JoinColumn(name = "tier_list_id", nullable = false)
    private TierList tierList;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("personajeId")
    @JoinColumn(name = "personaje_id", nullable = false)
    private Personaje personaje;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TierListTier tier;

    @Column(nullable = false)
    private int posicion;

    public TierListItem() {
    }

    public TierListItem(TierList tierList, Personaje personaje, TierListTier tier, int posicion) {
        this.tierList = tierList;
        this.personaje = personaje;
        this.tier = tier;
        this.posicion = posicion;
        this.id = new TierListItemId(
                tierList != null ? tierList.getId() : null,
                personaje != null ? personaje.getId() : null);
    }
}
