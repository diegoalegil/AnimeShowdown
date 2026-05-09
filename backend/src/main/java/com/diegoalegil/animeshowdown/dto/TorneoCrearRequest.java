package com.diegoalegil.animeshowdown.dto;

public class TorneoCrearRequest {

    private String nombre;
    private String descripcion;

    public TorneoCrearRequest() {
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
    
}
