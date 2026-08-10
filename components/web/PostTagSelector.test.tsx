import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostTagSelector } from "./PostTagSelector";

describe("PostTagSelector", () => {
  it("reports checkbox selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PostTagSelector value={[]} onChange={onChange} />);

    await user.click(screen.getByLabelText("Technology"));
    expect(onChange).toHaveBeenCalledWith(["Technology"]);
  });

  it("gives immediate feedback instead of selecting a sixth tag", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PostTagSelector
        value={["Technology", "Design", "Music", "Theory", "Landscape"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Science"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Choose up to 5 tags.")).toBeInTheDocument();
  });
});
