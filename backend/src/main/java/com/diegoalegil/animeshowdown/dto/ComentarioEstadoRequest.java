package com.diegoalegil.animeshowdown.dto;

import com.diegoalegil.animeshowdown.model.ComentarioEstado;

import jakarta.validation.constraints.NotNull;

public record ComentarioEstadoRequest(@NotNull ComentarioEstado estado) {
}
