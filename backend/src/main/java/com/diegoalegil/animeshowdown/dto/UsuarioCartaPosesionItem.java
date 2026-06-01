package com.diegoalegil.animeshowdown.dto;

import java.io.Serializable;

public record UsuarioCartaPosesionItem(
        Long cartaId,
        int cantidad) implements Serializable {
}
