package com.diegoalegil.animeshowdown.security;

public final class LogSanitizer {

    private LogSanitizer() {}

    public static String email(String value) {
        if (value == null || value.isBlank()) {
            return "<empty>";
        }
        String email = value.trim();
        int at = email.indexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return mask(email);
        }
        return mask(email.substring(0, at)) + "@" + maskDomain(email.substring(at + 1));
    }

    public static String identifier(String value) {
        if (value == null || value.isBlank()) {
            return "<empty>";
        }
        String identifier = value.trim();
        return identifier.contains("@") ? email(identifier) : identifier;
    }

    private static String mask(String value) {
        if (value.length() <= 1) {
            return "*";
        }
        return value.charAt(0) + "***";
    }

    private static String maskDomain(String domain) {
        int dot = domain.lastIndexOf('.');
        if (dot <= 0 || dot == domain.length() - 1) {
            return mask(domain);
        }
        return mask(domain.substring(0, dot)) + domain.substring(dot);
    }
}
