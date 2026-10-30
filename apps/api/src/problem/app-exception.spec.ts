import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app-exception";

describe("AppException", () => {
  it("keeps field errors led by the detail", () => {
    const errors = [
      { pointer: "/name", detail: "Informe o nome." },
      { pointer: "/password", detail: "Senha curta." },
    ];

    const exception = new AppException(
      HttpStatus.BAD_REQUEST,
      "Informe o nome.",
      { errors },
    );

    expect(exception.errors).toEqual(errors);
  });

  it("refuses field errors whose first message is not the detail", () => {
    expect(
      () =>
        new AppException(HttpStatus.BAD_REQUEST, "Informe o nome.", {
          errors: [{ pointer: "/password", detail: "Senha curta." }],
        }),
    ).toThrow();
  });

  it("refuses an empty list of field errors", () => {
    expect(
      () =>
        new AppException(HttpStatus.BAD_REQUEST, "Informe o nome.", {
          errors: [],
        }),
    ).toThrow();
  });
});
