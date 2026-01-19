import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/hermetic/sample-data")
public class SampleDataController {

    @GetMapping
    public ResponseEntity<List<SampleData>> listAllSamples() {
        List<SampleData> samples = new ArrayList<>();
        samples.add(new OrderSample());
        samples.add(new PaymentSample());
        samples.add(new UserSample());

        return ResponseEntity.status(HttpStatus.OK).body(samples);
    }

    @GetMapping("/{entityType}")
    public ResponseEntity<List<SampleData>> getEntitySamples(@PathVariable String entityType) {
        List<SampleData> samples = new ArrayList<>();
        switch (entityType.toLowerCase()) {
            case "order":
                samples.addAll(List.of(new OrderSample(), new OrderSample(), new OrderSample()));
                break;
            case "payment":
                samples.addAll(List.of(new PaymentSample(), new PaymentSample(), new PaymentSample()));
                break;
            case "user":
                samples.addAll(List.of(new UserSample(), new UserSample(), new UserSample()));
                break;
            default:
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        if (entityType.equals("order")) {
            // Add pagination
            int pageSize = 10;
            int pageNumber = 0;
            List<OrderSample> orderSamples = samples.stream()
                    .filter(sample -> sample instanceof OrderSample)
                    .map(sample -> (OrderSample) sample)
                    .limit(pageSize * 1L)
                    .collect(Collectors.toList());
            return ResponseEntity.status(HttpStatus.OK).body(orderSamples);
        } else if (entityType.equals("payment")) {
            // Add pagination
            int pageSize = 10;
            int pageNumber = 0;
            List<PaymentSample> paymentSamples = samples.stream()
                    .filter(sample -> sample instanceof PaymentSample)
                    .map(sample -> (PaymentSample) sample)
                    .limit(pageSize * 1L)
                    .collect(Collectors.toList());
            return ResponseEntity.status(HttpStatus.OK).body(paymentSamples);
        } else if (entityType.equals("user")) {
            // Add pagination
            int pageSize = 10;
            int pageNumber = 0;
            List<UserSample> userSamples = samples.stream()
                    .filter(sample -> sample instanceof UserSample)
                    .map(sample -> (UserSample) sample)
                    .limit(pageSize * 1L)
                    .collect(Collectors.toList());
            return ResponseEntity.status(HttpStatus.OK).body(userSamples);
        }

        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }
}

class OrderSample {
    private String id;
    private String userId;
    private String paymentMethod;

    public OrderSample() {
        this.id = "order-" + System.currentTimeMillis();
        this.userId = "user-1";
        this.paymentMethod = "credit-card";
    }

    // Getters and setters
}

class PaymentSample {
    private String id;
    private Double amount;
    private String paymentMethod;

    public PaymentSample() {
        this.id = "payment-" + System.currentTimeMillis();
        this.amount = 100.0;
        this.paymentMethod = "credit-card";
    }

    // Getters and setters
}

class UserSample {
    private String id;
    private String name;
    private String email;

    public UserSample() {
        this.id = "user-" + System.currentTimeMillis();
        this.name = "John Doe";
        this.email = "john@example.com";
    }

    // Getters and setters
}