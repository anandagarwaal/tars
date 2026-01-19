// PaymentGateway.java
public interface PaymentGateway {
    boolean processPayment(double amount);
}

// FakePaymentGateway.java
@Profile("hermetic")
public class FakePaymentGateway implements PaymentGateway {

    private static final Map<String, Boolean> responses = new HashMap<>();
    private static final Random random = new Random();

    public FakePaymentGateway() {
        // Initialize responses with default values
        responses.put("success", random.nextBoolean());
        responses.put("failure", !responses.get("success"));
    }

    @Override
    public boolean processPayment(double amount) {
        return responses.getOrDefault("default", false);
    }

    public void setResponse(String scenario, boolean response) {
        responses.put(scenario, response);
    }
}

// InventoryService.java
public interface InventoryService {
    double getAvailableQuantity();
}

// FakeInventoryService.java
@Profile("hermetic")
public class FakeInventoryService implements InventoryService {

    private static final Map<String, Double> quantities = new HashMap<>();
    private static final Random random = new Random();

    public FakeInventoryService() {
        // Initialize quantities with default values
        quantities.put("product1", 100.0);
        quantities.put("product2", 50.0);
    }

    @Override
    public double getAvailableQuantity() {
        return quantities.getOrDefault("default", 0.0);
    }

    public void setQuantity(String product, double quantity) {
        quantities.put(product, quantity);
    }
}

// PaymentService.java
public interface PaymentService {
    boolean processPayment(double amount);
}

// FakePaymentService.java
@Profile("hermetic")
public class FakePaymentService implements PaymentService {

    private final PaymentGateway paymentGateway;
    private final InventoryService inventoryService;

    public FakePaymentService(PaymentGateway paymentGateway, InventoryService inventoryService) {
        this.paymentGateway = paymentGateway;
        this.inventoryService = inventoryService;
    }

    @Override
    public boolean processPayment(double amount) {
        // Check if product is available
        double quantity = inventoryService.getAvailableQuantity();
        if (quantity < 1.0) {
            return false; // Product not available
        }

        // Process payment using fake payment gateway
        return paymentGateway.processPayment(amount);
    }
}

// LoggingUtil.java
public class LoggingUtil {

    public static void debug(String message) {
        System.out.println("DEBUG: " + message);
    }
}

// PaymentServiceTest.java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

public class PaymentServiceTest {

    @ParameterizedTest
    @CsvSource({"success, true", "failure, false"})
    public void testProcessPayment(boolean expected, boolean response) {
        FakePaymentGateway fakePaymentGateway = new FakePaymentGateway();
        fakePaymentGateway.setResponse("default", response);
        FakePaymentService fakePaymentService = new FakePaymentService(fakePaymentGateway, new FakeInventoryService());
        assertTrue(fakePaymentService.processPayment(10.0) == expected);
    }

    @Test
    public void testProcessPaymentFailure() {
        FakePaymentGateway fakePaymentGateway = new FakePaymentGateway();
        fakePaymentGateway.setResponse("failure", false);
        FakePaymentService fakePaymentService = new FakePaymentService(fakePaymentGateway, new FakeInventoryService());
        assertFalse(fakePaymentService.processPayment(10.0));
    }
}

// PaymentServiceTestWithFailureInjection.java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

public class PaymentServiceTestWithFailureInjection {

    @ParameterizedTest
    @CsvSource({"success, true", "failure, false"})
    public void testProcessPayment(boolean expected, boolean response) {
        FakePaymentGateway fakePaymentGateway = new FakePaymentGateway();
        fakePaymentGateway.setResponse("default", response);
        FakePaymentService fakePaymentService = new FakePaymentService(fakePaymentGateway, new FakeInventoryService());
        assertTrue(fakePaymentService.processPayment(10.0) == expected);

        // Inject failure for negative testing
        fakePaymentGateway.setResponse("failure", false);
        assertFalse(fakePaymentService.processPayment(10.0));
    }
}