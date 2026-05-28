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

    public static String textWithMaskedEmails(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(
                "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}").matcher(value);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            matcher.appendReplacement(sb,
                    java.util.regex.Matcher.quoteReplacement(email(matcher.group())));
        }
        matcher.appendTail(sb);
        return sb.toString();
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
