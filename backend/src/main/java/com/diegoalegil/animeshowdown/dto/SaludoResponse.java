package com.diegoalegil.animeshowdown.dto;

public class SaludoResponse {

    private String saludo;
    private String mensaje;

    public SaludoResponse(String saludo, String mensaje) {
        this.saludo = saludo;
        this.mensaje = mensaje;
    }

    public String getSaludo() {
        return saludo;
    }

    public void setSaludo(String saludo) {
        this.saludo = saludo;
    }

    public String getMensaje() {
        return mensaje;
    }

    public void setMensaje(String mensaje) {
        this.mensaje = mensaje;
    }

    
    

}
