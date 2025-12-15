PDF=main.pdf
TEX=main.tex

all: $(PDF)

$(PDF): $(TEX)
	@if command -v tectonic >/dev/null 2>&1; then \
		echo "Using tectonic to compile PDF"; \
		tectonic -X compile $(TEX); \
	else \
		echo "tectonic not found; falling back to pdflatex"; \
		pdflatex -interaction=nonstopmode -halt-on-error $(TEX); \
		pdflatex -interaction=nonstopmode -halt-on-error $(TEX); \
	fi

clean:
	rm -f *.aux *.log *.out *.toc *.pdf
