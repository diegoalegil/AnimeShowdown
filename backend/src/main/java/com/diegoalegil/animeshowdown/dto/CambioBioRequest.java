package com.diegoalegil.animeshowdown.dto;

import jakarta.validation.constraints.Size;

/**
 * B7 §1a: edición de la bio pública desde Ajustes.
 *
 * <p>La bio es opcional —enviar {@code null} o cadena vacía la borra— y se
 * limita a 240 caracteres. El servidor hace strip de HTML/scripts y trim
 * antes de persistir (texto plano), así que el {@code @Size} aquí solo
 * acota el payload de entrada; la longitud final puede ser menor.
 */
public class CambioBioRequest {

    @Size(max = 240, message = "La bio no puede superar los 240 caracteres")
    private String bio;

    public CambioBioRequest() {
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }
}
