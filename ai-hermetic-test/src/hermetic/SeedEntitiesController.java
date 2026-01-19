import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition profiles.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/hermetic")
@Profile("hermetic")
public class SeedEntitiesController {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final ExecutorService executorService;

    @Autowired
    public SeedEntitiesController(OrderRepository orderRepository, PaymentRepository paymentRepository, UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.executorService = Executors.newFixedThreadPool(5);
    }

    /**
     * Seeds entities into the database.
     *
     * @param entities List of entities to seed
     * @return Response with seeded entity IDs
     */
    @PostMapping("/seedEntities")
    public ResponseEntity<SeededEntityResponse> seedEntities(@RequestBody List<Entity> entities) {
        var response = new SeededEntityResponse();
        var taskList = new CompletableFuture<List<Integer>>[entities.size()];

        for (var i = 0; i < entities.size(); i++) {
            var entity = entities.get(i);
            var task = executorService.submit(() -> seedEntity(entity));
            taskList[i] = task;
        }

        CompletableFuture.allOf(taskList).join();

        return ResponseEntity.ok(response);
    }

    private void seedEntity(Entity entity) {
        try {
            if (entity instanceof Order) {
                orderRepository.save((Order) entity);
            } else if (entity instanceof Payment) {
                paymentRepository.save((Payment) entity);
            } else if (entity instanceof User) {
                userRepository.save((User) entity);
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static class SeededEntityResponse {
        private List<Integer> seededEntityIds = new ArrayList<>();

        public void addSeededEntityId(int id) {
            this.seededEntityIds.add(id);
        }

        public List<Integer> getSeededEntityIds() {
            return seededEntityIds;
        }
    }
}

interface OrderRepository extends JpaRepository<Order, Long> {}

interface PaymentRepository extends JpaRepository<Payment, Long> {}

interface UserRepository extends JpaRepository<User, Long> {}

enum Entity {
    ORDER,
    PAYMENT,
    USER
}