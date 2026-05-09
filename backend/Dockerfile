# --- Build stage ---
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

# Cachea las dependencias (capa separada para builds incrementales rápidos)
COPY mvnw ./
COPY .mvn .mvn
COPY pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Compila el JAR
COPY src src
RUN ./mvnw clean package -DskipTests

# --- Runtime stage ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copia solo el JAR final (la imagen final es mucho más ligera)
COPY --from=builder /app/target/animeshowdown-0.0.1-SNAPSHOT.jar app.jar

# Render inyecta la variable PORT; Spring la lee gracias a server.port=${PORT:8080}
EXPOSE 8080

# -Xmx400m mantiene la JVM dentro de los 512MB del plan Free
# -XX:TieredStopAtLevel=1 acelera el arranque sacrificando algo de optimización JIT (OK para Free tier con 0.1 CPU)
ENTRYPOINT ["sh", "-c", "java -Xmx400m -XX:+UseContainerSupport -XX:TieredStopAtLevel=1 -Dspring.main.lazy-initialization=true -jar app.jar"]
