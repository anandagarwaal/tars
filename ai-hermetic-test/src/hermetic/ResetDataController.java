import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition profiles.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.util.List;

@RestController
@Profile("hermetic")
public class ResetDataController {

    private final EntityManager entityManager;

    @Autowired
    public ResetDataController(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @PostMapping("/hermetic/reset")
    public ResponseEntity<String> resetAll() {
        try (EntityManager transactionalEntityManager = entityManager.getTransaction().begin()) {
            transactionalEntityManager.setReadOnly(true);
            transactionalEntityManager.flush();
            transactionalEntityManager.clear();

            if (!entityManager.isOpen()) {
                throw new RuntimeException("No active EntityManager found");
            }

            transactionalEntityManager.getTransaction().commit();
            return ResponseEntity.status(HttpStatus.OK).body("All data reset successfully");
        } catch (Exception e) {
            entityManager.getTransaction().rollback();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PostMapping("/hermetic/reset/{entityType}")
    public ResponseEntity<String> reset(@PathVariable String entityType) {
        try (EntityManager transactionalEntityManager = entityManager.getTransaction().begin()) {
            transactionalEntityManager.setReadOnly(true);
            transactionalEntityManager.flush();
            transactionalEntityManager.clear();

            if (!entityManager.isOpen()) {
                throw new RuntimeException("No active EntityManager found");
            }

            switch (entityType.toLowerCase()) {
                case "order":
                    resetOrders(transactionalEntityManager);
                    break;
                case "payment":
                    resetPayments(transactionalEntityManager);
                    break;
                case "user":
                    resetUsers(transactionalEntityManager);
                    break;
                default:
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Unsupported entity type");
            }

            transactionalEntityManager.getTransaction().commit();
            return ResponseEntity.status(HttpStatus.OK).body("Data for " + entityType + " reset successfully");
        } catch (Exception e) {
            entityManager.getTransaction().rollback();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    private void resetOrders(EntityManager transactionalEntityManager) {
        // Implement logic to reset orders
    }

    private void resetPayments(EntityManager transactionalEntityManager) {
        // Implement logic to reset payments
    }

    private void resetUsers(EntityManager transactionalEntityManager) {
        // Implement logic to reset users
    }
}